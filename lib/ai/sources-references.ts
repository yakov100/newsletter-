import type { WritingAgentConfig } from "@/lib/agent-config";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export interface SourceReference {
  title: string;
  url: string;
  description?: string;
}

/** מציע מקורות וסימוכין רלוונטיים לפי תוכן הטיוטה. מחזיר רשימת מקורות (כותרת, קישור, תיאור אופציונלי). */
export async function getSourcesReferences(
  config: WritingAgentConfig,
  draftHtml: string
): Promise<SourceReference[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  const text = stripHtml(draftHtml);
  if (!text.trim()) return [];
  if (!apiKey) return [];

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });
  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: config.systemPrompt },
      {
        role: "user",
        content: `תבסס על הטיוטה הבאה, הצע 3–5 מקורות וסימוכין רלוונטיים (מאמרים, מחקרים, אתרים רשמיים) שיכולים לחזק את הכתבה. כל מקור: כותרת ברורה, כתובת URL אמיתית (https), ותיאור קצר (משפט אחד) אופציונלי. החזר JSON בלבד בפורמט: { "sources": [ { "title": "כותרת", "url": "https://...", "description": "תיאור" }, ... ] }. וודא שה-URLs תקינים. טיוטה:\n\n${text.slice(0, 4000)}`,
      },
    ],
  });
  const raw = res.choices[0]?.message?.content?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { sources?: SourceReference[] };
    const list = Array.isArray(parsed.sources) ? parsed.sources : [];
    return list
      .filter((s) => s && typeof s.title === "string" && typeof s.url === "string")
      .map((s) => ({
        title: String(s.title).trim(),
        url: String(s.url).trim(),
        description: s.description != null ? String(s.description).trim() : undefined,
      }))
      .slice(0, 8);
  } catch {
    return [];
  }
}
