import type { WritingAgentConfig } from "@/lib/agent-config";
import { webSearch } from "./web-search";

const OUTLINE_SOURCES_NUM = 6;
const PLACEHOLDER_RULE =
  "אל תכלול בשלד שום שם של אדם, ארגון, מקום, תאריך או מספר אלא אם הוא מופיע במפורש במקור/במידע שלפניך. אם יש ספק – כתוב [שם הדמות], [תאריך], [מקום] או [לבדיקה].";

function buildOutlineUserMessage(
  title: string,
  description: string,
  sources: Array<{ title?: string; snippet: string }>
): string {
  const base = `צור שלד קצר לכתבה לפי הרעיון הבא – רק תבנית, לא גוף הכתבה.

כותרת: ${title}
תיאור: ${description}
`;
  const sourcesBlock =
    sources.length > 0
      ? `

מקורות מהרשת (בנה שלד רק על בסיס המידע הבא – אסור להוסיף שום שם, תאריך, מקום או מספר שלא מופיע במפורש כאן; אם משהו לא ברור – השאר [לבדיקה] או [שם]/[תאריך]):
---
${sources.map((s) => `${s.title ? `[${s.title}]\n` : ""}${s.snippet}`).join("\n\n---\n")}
---
`
      : "";
  const instructions = `

החזר רק שלד: כותרות או משפט אחד לכל חלק (פתיחה, גוף, סיום). בלי פסקאות מלאות, בלי טקסט הכתבה עצמה. המטרה שהשלד יהיה רשימת נקודות/כותרות להנחיה בלבד – הכתבה המלאה תיכתב אחר כך. כל נקודה בשלד חייבת להתייחס רק לאירועים/עובדות מתועדות – לא להמציא.
${sources.length === 0 ? `\n${PLACEHOLDER_RULE}` : ""}`;
  return base + sourcesBlock + instructions;
}

function hasWebSearch(): boolean {
  return (
    Boolean(process.env.TAVILY_API_KEY?.trim()) ||
    Boolean(process.env.SERPER_API_KEY?.trim())
  );
}

/** מחזיר 5–8 snippets מחיפוש ברשת לפי כותרת + תיאור, לשימוש ב־sources-first. */
async function fetchOutlineSources(
  title: string,
  description: string
): Promise<Array<{ title?: string; snippet: string }>> {
  const query = [title, description].filter(Boolean).join(" ").trim().slice(0, 200);
  if (!query) return [];
  const results = await webSearch(query, { num: OUTLINE_SOURCES_NUM });
  return results
    .map((r) => ({
      title: r.title || undefined,
      snippet: (r.snippet || "").trim(),
    }))
    .filter((s) => s.snippet.length > 0);
}

export async function generateOutline(
  config: WritingAgentConfig,
  title: string,
  description: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return getMockOutline(title, description);
  }
  const sources = hasWebSearch()
    ? await fetchOutlineSources(title, description)
    : [];
  const userContent = buildOutlineUserMessage(title, description, sources);
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });
  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: config.systemPrompt },
      { role: "user", content: userContent },
    ],
    max_tokens: 1024,
  });
  const outline = res.choices[0]?.message?.content?.trim() ?? getMockOutline(title, description);
  return outline;
}

function getMockOutline(title: string, _description: string): string {
  return `פתיחה: הצגת הנושא והשאלה המרכזית.\nגוף: 2–3 נקודות עיקריות + דוגמאות.\nסיום: סיכום או קריאה לפעולה.\n\n(שלד לדוגמה ל: ${title})`;
}
