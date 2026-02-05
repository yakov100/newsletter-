import type { IdeasAgentConfig } from "@/lib/agent-config";
import type { Idea } from "@/types/idea";

function randomId(): string {
  return crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const FORMAT_INSTRUCTION =
  "ענה ב-JSON בלבד במבנה הזה בדיוק: { \"ideas\": [ { \"title\": \"כותרת\", \"description\": \"תיאור\" }, ... ] } – מערך ideas עם בדיוק 3 אובייקטים, כל אחד עם title ו-description. אל תעטוף ב-markdown או בטקסט נוסף.";
const NO_FABRICATION =
  "הצע רק סיפורים אמיתיים ומתועדים (שמות אמיתיים, אירועים שקרו). אסור להמציא אירועים, שמות, שבטים או מקומות.";
const USER_PROMPT = `${NO_FABRICATION}\n\nצור בדיוק 3 רעיונות לכתבה אחת. ${FORMAT_INSTRUCTION}`;

/** Remove tool/function call blocks from model output (for parsing and display). */
function stripToolCallSyntax(s: string): string {
  return s
    .replace(/web_search_function_calls>>[\s\S]*?(?=```|$)/gi, "")
    .replace(/<invoke\s+name="[^"]*">[\s\S]*?<\/invoke>/gi, "")
    .replace(/<parameter\s+name="[^"]*">[\s\S]*?<\/parameter>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same as above but without collapsing whitespace, for use before JSON parse. */
function stripToolCallSyntaxForParsing(s: string): string {
  return s
    .replace(/web_search_function_calls>>[\s\S]*?(?=```|$)/gi, "")
    .replace(/<invoke\s+name="[^"]*">[\s\S]*?<\/invoke>/gi, "")
    .replace(/<parameter\s+name="[^"]*">[\s\S]*?<\/parameter>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/** Try to get parseable JSON from model output (code blocks, raw JSON, or {...} substring). */
function extractJsonString(content: string): string {
  let s = content.trim();
  // Remove BOM / zero-width chars
  s = s.replace(/^\uFEFF/, "").replace(/\u200B|\u200C|\u200D|\uFEFF/g, "");
  const codeBlock = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  // If whole string looks like object, use it
  if (s.startsWith("{") && s.endsWith("}")) return s;
  // Otherwise find first { and last } and extract (handles "Here is the JSON: {...}")
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return s.slice(start, end + 1);
  return s;
}

/** Remove trailing commas before ] or }. */
function removeTrailingCommas(s: string): string {
  return s.replace(/,(\s*[}\]])/g, "$1");
}

/**
 * Fix common LLM JSON issues inside double-quoted strings using a simple state machine:
 * - unescaped newlines, \\r, \\t -> \\n, \\r, \\t
 * - unescaped " inside a value (when next non-space is not : , } ]) -> \\"
 */
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
        // Peek ahead: if next non-space is : , } ] then this " closes the string
        let j = i + 1;
        while (j < s.length && /[\s\n\r\t]/.test(s[j])) j++;
        if (j < s.length && /[:,}\]]/.test(s[j])) {
          out += c;
          inString = false;
          i++;
          continue;
        }
        // Unescaped quote inside value – escape it
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

/** Extract ideas from parsed object. */
function ideasFromParsed(parsed: Record<string, unknown>): Idea[] {
  const raw: Array<{ title?: string; description?: string }> = Array.isArray(parsed.ideas)
    ? parsed.ideas
    : Array.isArray(parsed.suggestions)
      ? parsed.suggestions
      : [];
  return raw.slice(0, 3).map((item, i) => ({
    id: randomId(),
    title: String(item.title ?? `רעיון ${i + 1}`).slice(0, 200),
    description: String(item.description ?? "").slice(0, 500),
  }));
}

/**
 * Fallback: extract idea-like objects from text when JSON is too broken.
 * Looks for "title" and "description" (or "תיאור"/"כותרת") near each other.
 */
function extractIdeasFallback(content: string): Idea[] {
  const ideas: Idea[] = [];
  // Match objects that have title and description (English or Hebrew keys)
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
      });
    }
    if (ideas.length >= 3) break;
  }
  if (ideas.length > 0) return ideas;
  // Do NOT return a single "רעיון מהתשובה" – we want exactly 3 ideas. Let the caller throw.
  return [];
}

function parseIdeasFromResponse(content: string): Idea[] {
  const contentWithoutToolCalls = stripToolCallSyntaxForParsing(content);
  const jsonStr = normalizeJson(extractJsonString(contentWithoutToolCalls));
  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const result = ideasFromParsed(parsed);
    if (result.length > 0) return result;
  } catch {
    // JSON parse failed – try fallback extraction
  }
  const fallback = extractIdeasFallback(contentWithoutToolCalls);
  if (fallback.length > 0) return fallback;
  throw new Error("לא הצלחנו לפרש את תשובת Claude. נסה שוב או צור רעיון משלך.");
}

export async function generateIdeas(config: IdeasAgentConfig): Promise<Idea[]> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return generateIdeasWithClaude(config, anthropicKey);
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return generateIdeasWithOpenAI(config, openaiKey);
  }
  throw new Error(
    "לא הוגדר מפתח API. הוסף ANTHROPIC_API_KEY או OPENAI_API_KEY לקובץ .env.local"
  );
}

async function generateIdeasWithClaude(
  config: IdeasAgentConfig,
  apiKey: string
): Promise<Idea[]> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
  const message = await client.messages.create({
    model,
    max_tokens: 1024,
    system: config.systemPrompt,
    tools: [
      { type: "web_search_20250305", name: "web_search", max_uses: 5 },
    ],
    messages: [{ role: "user", content: USER_PROMPT }],
  });
  const textBlock = message.content.find((b) => (b as { type: string }).type === "text");
  const content =
    textBlock && "text" in textBlock && typeof (textBlock as { text?: string }).text === "string"
      ? (textBlock as { text: string }).text.trim()
      : undefined;
  if (!content) throw new Error("לא התקבלה תשובה מ-Claude");
  try {
    return parseIdeasFromResponse(content);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`תשובת Claude אינה JSON תקין. ${detail}`);
  }
}

async function generateIdeasWithOpenAI(
  config: IdeasAgentConfig,
  apiKey: string
): Promise<Idea[]> {
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });
  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: config.systemPrompt },
      { role: "user", content: USER_PROMPT },
    ],
    response_format: { type: "json_object" },
    max_tokens: 1024,
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("לא התקבלה תשובה מ-AI");
  try {
    return parseIdeasFromResponse(content);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`תשובת AI אינה JSON תקין. ${detail}`);
  }
}

