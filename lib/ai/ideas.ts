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

/** Allow trailing commas and strip them so JSON.parse accepts. */
function normalizeJson(s: string): string {
  return s.replace(/,(\s*[}\]])/g, "$1");
}

function parseIdeasFromResponse(content: string): Idea[] {
  const jsonStr = normalizeJson(extractJsonString(content));
  const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
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
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
  const message = await client.messages.create({
    model,
    max_tokens: 1024,
    system: config.systemPrompt,
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

