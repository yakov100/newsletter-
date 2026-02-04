import type { WritingAgentConfig } from "@/lib/agent-config";

/** מרחיב פסקה/טקסט שנבחר. מחזיר טקסט מורחב (לא HTML). */
export async function expandText(
  config: WritingAgentConfig,
  text: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const trimmed = text.trim();
  if (!trimmed) return text;
  if (!apiKey) return trimmed;

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });
  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: config.systemPrompt },
      {
        role: "user",
        content: `הטקסט הבא הוא פסקה או משפט מתוך טיוטה. הרחב אותו – הוסף פרטים, דוגמאות או הסברים קצרים, בלי לשנות את הטון. החזר רק את הטקסט המורחב, בלי הסברים.

טקסט להרחבה:\n${trimmed.slice(0, 2000)}`,
      },
    ],
  });
  const content = res.choices[0]?.message?.content?.trim();
  return content ?? trimmed;
}
