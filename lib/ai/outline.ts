import type { WritingAgentConfig } from "@/lib/agent-config";

export async function generateOutline(
  config: WritingAgentConfig,
  title: string,
  description: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return getMockOutline(title, description);
  }
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });
  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: config.systemPrompt },
      {
        role: "user",
        content: `צור שלד קצר לכתבה לפי הרעיון הבא – רק תבנית, לא גוף הכתבה.

כותרת: ${title}
תיאור: ${description}

החזר רק שלד: כותרות או משפט אחד לכל חלק (פתיחה, גוף, סיום). בלי פסקאות מלאות, בלי טקסט הכתבה עצמה. המטרה שהשלד יהיה רשימת נקודות/כותרות להנחיה בלבד – הכתבה המלאה תיכתב אחר כך. כל נקודה בשלד חייבת להתייחס רק לאירועים/עובדות מתועדות – לא להמציא.`,
      },
    ],
  });
  const outline = res.choices[0]?.message?.content?.trim() ?? getMockOutline(title, description);
  return outline;
}

function getMockOutline(title: string, _description: string): string {
  return `פתיחה: הצגת הנושא והשאלה המרכזית.\nגוף: 2–3 נקודות עיקריות + דוגמאות.\nסיום: סיכום או קריאה לפעולה.\n\n(שלד לדוגמה ל: ${title})`;
}
