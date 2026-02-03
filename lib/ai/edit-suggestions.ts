import type { WritingAgentConfig } from "@/lib/agent-config";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export async function getEditSuggestions(
  config: WritingAgentConfig,
  draftHtml: string
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  const text = stripHtml(draftHtml);
  if (!text) return [];
  if (!apiKey) {
    return [
      "בדוק משפטים ארוכים – אולי לפצל או לקצר.",
      "וודא שכל פסקה מתחילה בנושא ברור.",
      "חפש מילים חוזרות והחלף בחלופות מתאימות.",
    ];
  }
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });
  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: config.systemPrompt },
      {
        role: "user",
        content: `הטיוטה הבאה צריכה עריכה (חידוד ניסוחים, קיצור, בהירות). החזר רשימה של 3–5 הצעות לשיפור בלבד, כל אחת בשורה נפרדת, בלי להחזיר את הטקסט עצמו. טיוטה:\n\n${text.slice(0, 4000)}`,
      },
    ],
  });
  const content = res.choices[0]?.message?.content?.trim();
  if (!content) return [];
  return content.split(/\n/).map((s) => s.replace(/^[-•*\d.)\s]+/, "").trim()).filter(Boolean);
}
