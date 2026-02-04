import type { WritingAgentConfig } from "@/lib/agent-config";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** מחזיר את הטיוטה לאחר יישום ההוראה. ה-AI מחזיר HTML. */
export async function applyInstruction(
  config: WritingAgentConfig,
  draftHtml: string,
  instruction: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const text = stripHtml(draftHtml);
  if (!text) return draftHtml;
  if (!instruction.trim()) return draftHtml;
  if (!apiKey) return draftHtml;

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });
  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: config.systemPrompt },
      {
        role: "user",
        content: `הטיוטה הבאה (ב-HTML) צריכה לעבור שינוי לפי ההוראה. החזר את כל הטיוטה המעודכנת ב-HTML בלבד – אותן תגיות (p, strong, h2 וכו'), בלי הסברים.

הוראה: ${instruction}

טיוטה נוכחית:\n${draftHtml.slice(0, 8000)}`,
      },
    ],
  });
  const content = res.choices[0]?.message?.content?.trim();
  if (!content) return draftHtml;
  return content;
}
