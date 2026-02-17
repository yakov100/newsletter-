/**
 * Responses API עם כלי web_search של OpenAI.
 * מפחית הזיות על ידי חיפוש אמיתי ברשת וציטוטי מקור (url_citation).
 * לפי: https://platform.openai.com/docs/guides/tools-web-search
 */

import type OpenAI from "openai";

export interface ResponsesWebSearchResult {
  /** טקסט התשובה (כולל output_text מכל הודעות המודל). */
  outputText: string;
  /** ציטוטי URL מהתשובה (מקורות שהמודל ציטט). */
  urlCitations: Array< { url: string; title: string; startIndex: number; endIndex: number } >;
  /** רשימת כל ה-URLs שהמודל צרך (אם ביקשנו include: web_search_call.action.sources). */
  sources?: string[];
}

type OpenAIClient = InstanceType<typeof OpenAI>;

const DEFAULT_MODEL = "gpt-4o-mini";
const RESPONSES_TIMEOUT_MS = 30_000;

/**
 * קורא ל-Responses API עם כלי web_search.
 * המודל יכול לבצע חיפוש ברשת ולצטט מקורות – מתאים לאימות עובדות ולהפחתת הזיות.
 *
 * @param client - OpenAI client (new OpenAI({ apiKey }))
 * @param input - טקסט הקלט (שאלה או הוראה)
 * @param options - instructions, model, include sources
 */
export async function createResponseWithWebSearch(
  client: OpenAIClient,
  input: string,
  options?: {
    instructions?: string;
    model?: string;
    maxOutputTokens?: number;
    includeSources?: boolean;
    /** הגבלת דומיינים (ללא https://). */
    allowedDomains?: string[];
  }
): Promise<ResponsesWebSearchResult> {
  const model = options?.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const include: ("web_search_call.action.sources")[] = options?.includeSources
    ? ["web_search_call.action.sources"]
    : [];

  const tools = [
    options?.allowedDomains?.length
      ? {
          type: "web_search" as const,
          filters: { allowed_domains: options.allowedDomains },
        }
      : { type: "web_search" as const },
  ];

  const body = {
    model,
    input,
    instructions: options?.instructions ?? undefined,
    max_output_tokens: options?.maxOutputTokens ?? 4096,
    tools,
    tool_choice: "auto",
    ...(include.length > 0 && { include }),
  } as Parameters<OpenAIClient["responses"]["create"]>[0];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESPONSES_TIMEOUT_MS);
  let response: Awaited<ReturnType<OpenAIClient["responses"]["create"]>>;
  try {
    response = await client.responses.create(body, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  const outputText = "output_text" in response && typeof response.output_text === "string"
    ? response.output_text
    : "";
  const urlCitations: ResponsesWebSearchResult["urlCitations"] = [];

  const output = "output" in response && Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (item.type === "message" && "content" in item && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (part.type === "output_text" && "annotations" in part && Array.isArray(part.annotations)) {
          for (const ann of part.annotations) {
            if (ann.type === "url_citation" && "url" in ann) {
              urlCitations.push({
                url: ann.url,
                title: (ann as { title?: string }).title ?? "",
                startIndex: (ann as { start_index?: number }).start_index ?? 0,
                endIndex: (ann as { end_index?: number }).end_index ?? 0,
              });
            }
          }
        }
      }
    }
  }

  let sources: string[] | undefined;
  if (options?.includeSources) {
    sources = [];
    for (const item of output) {
      if (
        item.type === "web_search_call" &&
        "action" in item &&
        item.action &&
        typeof item.action === "object" &&
        "sources" in item.action &&
        Array.isArray((item.action as { sources?: unknown[] }).sources)
      ) {
        const arr = (item.action as { sources: Array<{ url?: string }> }).sources;
        for (const s of arr) {
          if (s?.url) sources.push(s.url);
        }
      }
    }
  }

  return { outputText, urlCitations, sources };
}
