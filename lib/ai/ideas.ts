import type { IdeasAgentConfig } from "@/lib/agent-config";
import type { Idea, IdeaConfidenceLevel, IdeaSource } from "@/types/idea";
import { webSearch } from "./web-search";
import { searchWikipediaAndGetSummaries } from "./wikipedia";

function randomId(): string {
  return crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Fixed rules prepended to ideas system prompt – no fabrication, context-only. */
const FIXED_SYSTEM_RULES =
  "אתה עוזר עריכה עיתונאי. אסור לך להמציא אירועים, אנשים, מקומות או תאריכים. מותר להשתמש אך ורק במידע שנמסר לך במפורש. במקרה של ספק – ציין חוסר ודאות. אי עמידה בהנחיות נחשבת שגיאה.\n\n";

/** Search queries for RAG – real documented stories/themes. */
const RAG_SEARCH_QUERIES = [
  "סיפורים אמיתיים יוצאי דופן מתועדים היסטוריה",
  "תעלומות היסטוריות אמיתיות מתועדות",
  "הונאות ותעלולים מתועדים סיפורים אמיתיים",
];

/** English queries for Wikipedia (en.wikipedia.org search). */
const RAG_WIKIPEDIA_QUERIES = [
  "famous true historical stories documented",
  "documented hoaxes and cons real events",
];

const MAX_SOURCES_TOTAL = 22;
const RESULTS_PER_QUERY = 6;
const WIKIPEDIA_SUMMARIES_PER_QUERY = 2;

export interface RagContext {
  /** Block to inject in user message: numbered sources with id, title, snippet, link. */
  contextBlock: string;
  /** Map source_id (e.g. s1) -> IdeaSource for resolving idea.sourceIds. */
  sourcesMap: Map<string, IdeaSource>;
}

function hasWebSearch(): boolean {
  return (
    Boolean(process.env.TAVILY_API_KEY?.trim()) ||
    Boolean(process.env.SERPER_API_KEY?.trim())
  );
}

/**
 * Run 2–3 web searches, collect results with ids (s1, s2, …), build context block and sources map.
 */
export async function fetchRagContext(): Promise<RagContext> {
  const seen = new Set<string>();
  const list: { id: string; title: string; link: string; snippet: string }[] = [];
  let idNum = 1;

  for (const query of RAG_SEARCH_QUERIES) {
    if (list.length >= MAX_SOURCES_TOTAL) break;
    const results = await webSearch(query, {
      num: Math.min(RESULTS_PER_QUERY, MAX_SOURCES_TOTAL - list.length),
    });
    for (const r of results) {
      const key = r.link;
      if (seen.has(key)) continue;
      seen.add(key);
      const id = `s${idNum++}`;
      list.push({
        id,
        title: r.title,
        link: r.link,
        snippet: r.snippet,
      });
    }
  }

  // Add Wikipedia summaries (en.wikipedia.org) as extra sources w1, w2, …
  let wikiIdNum = 1;
  for (const query of RAG_WIKIPEDIA_QUERIES) {
    if (list.length >= MAX_SOURCES_TOTAL) break;
    try {
      const summaries = await searchWikipediaAndGetSummaries(
        query,
        WIKIPEDIA_SUMMARIES_PER_QUERY
      );
      for (const s of summaries) {
        if (seen.has(s.url)) continue;
        seen.add(s.url);
        const id = `w${wikiIdNum++}`;
        list.push({
          id,
          title: `ויקיפדיה: ${s.title}`,
          link: s.url,
          snippet: s.extract.slice(0, 600),
        });
      }
    } catch {
      // Skip Wikipedia on network/API errors
    }
  }

  const sourcesMap = new Map<string, IdeaSource>();
  const lines: string[] = [];
  for (const s of list) {
    sourcesMap.set(s.id, { id: s.id, title: s.title, link: s.link, snippet: s.snippet });
    lines.push(
      `[${s.id}] כותרת: ${s.title}\nתקציר: ${s.snippet || "-"}\nקישור: ${s.link}`
    );
  }
  const contextBlock = lines.length
    ? "מקורות (השתמש רק במה שמופיע כאן):\n\n" + lines.join("\n\n")
    : "";

  return { contextBlock, sourcesMap };
}

function buildUserPromptWithRag(contextBlock: string): string {
  const base =
    "בהמשך למידע המצורף בלבד (מקורות למטה), הצע בדיוק 3 רעיונות לכתבות מגזין. לכל רעיון ציין מאילו מקורות (מזהי המקור, למשל s1, s2) הוא נגזר. אסור להוסיף אירועים, שמות או פרטים שלא מופיעים במקורות. אם אין די נתונים – כתוב במפורש.";
  const format =
    'ענה ב-JSON בלבד במבנה: { "ideas": [ { "title": "כותרת", "description": "תיאור", "based_on_sources": ["s1","s2"], "confidence_level": "high" או "medium" או "low" }, ... ] } – מערך ideas עם בדיוק 3 אובייקטים. based_on_sources: מזהי המקורות מהרשימה. confidence_level: רמת הביטחון שהרעיון מבוסס על המקורות. אל תעטוף ב-markdown או בטקסט נוסף.';
  if (!contextBlock) return base + "\n\n" + format;
  return base + "\n\n" + format + "\n\n" + contextBlock;
}

/** Try to get parseable JSON from model output (code blocks, raw JSON, or {...} substring). */
function extractJsonString(content: string): string {
  let s = content.trim();
  s = s.replace(/^\uFEFF/, "").replace(/\u200B|\u200C|\u200D|\uFEFF/g, "");
  const codeBlock = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  if (s.startsWith("{") && s.endsWith("}")) return s;
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return s.slice(start, end + 1);
  return s;
}

function removeTrailingCommas(s: string): string {
  return s.replace(/,(\s*[}\]])/g, "$1");
}

function repairJsonStrings(s: string): string {
  let out = "";
  let i = 0;
  let inString = false;
  let escapeNext = false;
  while (i < s.length) {
    const c = s[i];
    if (escapeNext) {
      out += c;
      escapeNext = false;
      i++;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        out += c;
        escapeNext = true;
        i++;
        continue;
      }
      if (c === '"') {
        let j = i + 1;
        while (j < s.length && /[\s\n\r\t]/.test(s[j])) j++;
        if (j < s.length && /[:,}\]]/.test(s[j])) {
          out += c;
          inString = false;
          i++;
          continue;
        }
        out += '\\"';
        i++;
        continue;
      }
      if (c === "\r" && s[i + 1] === "\n") {
        out += "\\n";
        i += 2;
        continue;
      }
      if (c === "\n" || c === "\r") {
        out += c === "\n" ? "\\n" : "\\r";
        i++;
        continue;
      }
      if (c === "\t") {
        out += "\\t";
        i++;
        continue;
      }
      out += c;
      i++;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function normalizeJson(s: string): string {
  return repairJsonStrings(removeTrailingCommas(s));
}

function parseConfidenceLevel(v: unknown): IdeaConfidenceLevel {
  if (v === "high" || v === "medium" || v === "low") return v;
  return "low";
}

/** Extract ideas from parsed object and resolve sources from map. */
function ideasFromParsed(
  parsed: Record<string, unknown>,
  sourcesMap: Map<string, IdeaSource>
): Idea[] {
  const raw: Array<{
    title?: string;
    description?: string;
    based_on_sources?: string[];
    confidence_level?: string;
  }> = Array.isArray(parsed.ideas)
    ? parsed.ideas
    : Array.isArray(parsed.suggestions)
      ? parsed.suggestions
      : [];
  return raw.slice(0, 3).map((item) => {
    const sourceIds = Array.isArray(item.based_on_sources)
      ? item.based_on_sources.filter((id) => typeof id === "string")
      : [];
    const sources: IdeaSource[] = sourceIds
      .map((id) => sourcesMap.get(String(id)))
      .filter((s): s is IdeaSource => Boolean(s));
    return {
      id: randomId(),
      title: String(item.title ?? "רעיון").slice(0, 200),
      description: String(item.description ?? "").slice(0, 500),
      sourceIds: sourceIds.length ? sourceIds : undefined,
      sources: sources.length ? sources : undefined,
      confidenceLevel: parseConfidenceLevel(item.confidence_level),
    };
  });
}

/**
 * Fallback: extract idea-like objects from text when JSON is too broken.
 * No source resolution – sourceIds/sources stay undefined, confidenceLevel low.
 */
function extractIdeasFallback(content: string, sourcesMap: Map<string, IdeaSource>): Idea[] {
  const ideas: Idea[] = [];
  const objectLike = content.split(/\}\s*,?\s*\{/);
  for (const block of objectLike) {
    const titleMatch = block.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"|"כותרת"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const descMatch = block.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"|"תיאור"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const title = (titleMatch?.[1] ?? titleMatch?.[2] ?? "").replace(/\\n/g, "\n").trim();
    const description = (descMatch?.[1] ?? descMatch?.[2] ?? "").replace(/\\n/g, "\n").trim();
    if (title || description) {
      ideas.push({
        id: randomId(),
        title: title.slice(0, 200) || `רעיון ${ideas.length + 1}`,
        description: description.slice(0, 500),
        confidenceLevel: "low",
      });
    }
    if (ideas.length >= 3) break;
  }
  if (ideas.length > 0) return ideas;
  const extracted = extractJsonString(content);
  if (extracted.length > 20) {
    return [
      {
        id: randomId(),
        title: "רעיון מהתשובה",
        description: extracted.replace(/\s+/g, " ").slice(0, 500),
        confidenceLevel: "low",
      },
    ];
  }
  return [];
}

function parseIdeasFromResponse(
  content: string,
  sourcesMap: Map<string, IdeaSource>
): Idea[] {
  const jsonStr = normalizeJson(extractJsonString(content));
  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const result = ideasFromParsed(parsed, sourcesMap);
    if (result.length > 0) return result;
  } catch {
    // ignore
  }
  const fallback = extractIdeasFallback(content, sourcesMap);
  if (fallback.length > 0) return fallback;
  throw new Error("לא הצלחנו לפרש את תשובת המודל. נסה שוב או צור רעיון משלך.");
}

export async function generateIdeas(config: IdeasAgentConfig): Promise<Idea[]> {
  if (!hasWebSearch()) {
    throw new Error(
      "נדרש חיפוש ברשת ליצירת רעיונות מבוססי מקורות. הגדר TAVILY_API_KEY או SERPER_API_KEY ב-.env.local, או השתמש ב״הזן רעיון משלך״."
    );
  }

  const { contextBlock, sourcesMap } = await fetchRagContext();
  const userPrompt = buildUserPromptWithRag(contextBlock);
  const systemPrompt = FIXED_SYSTEM_RULES + config.systemPrompt;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return generateIdeasWithClaude(systemPrompt, userPrompt, sourcesMap, anthropicKey);
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return generateIdeasWithOpenAI(systemPrompt, userPrompt, sourcesMap, openaiKey);
  }
  throw new Error(
    "לא הוגדר מפתח API. הוסף ANTHROPIC_API_KEY או OPENAI_API_KEY לקובץ .env.local"
  );
}

async function generateIdeasWithClaude(
  systemPrompt: string,
  userPrompt: string,
  sourcesMap: Map<string, IdeaSource>,
  apiKey: string
): Promise<Idea[]> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-20241022";
  const message = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const textBlock = message.content.find((b) => (b as { type: string }).type === "text");
  const content =
    textBlock && "text" in textBlock && typeof (textBlock as { text?: string }).text === "string"
      ? (textBlock as { text: string }).text.trim()
      : undefined;
  if (!content) throw new Error("לא התקבלה תשובה מ-Claude");
  try {
    return parseIdeasFromResponse(content, sourcesMap);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`תשובת Claude אינה JSON תקין. ${detail}`);
  }
}

async function generateIdeasWithOpenAI(
  systemPrompt: string,
  userPrompt: string,
  sourcesMap: Map<string, IdeaSource>,
  apiKey: string
): Promise<Idea[]> {
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });
  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_tokens: 1024,
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("לא התקבלה תשובה מ-AI");
  try {
    return parseIdeasFromResponse(content, sourcesMap);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`תשובת AI אינה JSON תקין. ${detail}`);
  }
}
