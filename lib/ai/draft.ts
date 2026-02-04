import type { WritingAgentConfig } from "@/lib/agent-config";

/** כללים קבועים בתחילת הנחיות הכתיבה – איסור המצאה. */
const FIXED_WRITING_RULES =
  "כלל ברזל – רק עובדות מתועדות: אסור להמציא פרטים, דיאלוגים, סצנות או תיאורים. בשלד: אסור להמציא שמות, תאריכים, מקומות או מספרים; אם אינך בטוח – השאר [לבדיקה] או placeholder מתאים (למשל [שם הדמות], [תאריך], [מקום]).\n\nכתוב רק מה שידוע ומתועד שקרה. אם פרט לא ודאי – השמט או ציין במפורש שמדובר בהערכה/מקור לא ודאי. אין \"כנראה\", \"סביר ש־\" או תיאורים מעוצבים מכח הדמיון.\n\n";

const DRAFT_USER_PROMPT = (
  title: string,
  description: string,
  outline: string
) => `כתוב את גוף הכתבה המלא (טקסט גולמי בלבד, בלי JSON) לפי הרעיון והשלד הבאים.

כותרת: ${title}
תיאור: ${description}

שלד (כולל הוספות והערות של המשתמש – הרחב הכל לכתבה מלאה):
${outline}

החזר רק את טקסט הכתבה: פסקאות מפורטות ומופרדות בשורה ריקה. כל נקודה או הוספה שמופיעה בשלד חייבת לקבל פיתוח מלא בכתבה. אל תחזיר את השלד כפי שהוא – כתוב כתבה מלאה עם פרטים, דוגמאות ומשפטים שלמים.

כותרות בגוף הכתבה: הוסף 3–4 כותרות משנה קצרות וקליטות שמפצלות את הכתבה לחלקים ברורים (לא "פתיחה" או "סיום" – כותרות תוכן). כל כותרת בשורה נפרדת עם הסימן ## בהתחלה, ואחריה שורה ריקה. דוגמה: ## מה בדיוק קרה שם. הכותרות יוצגו בעיצוב בולט בעורך.

חשוב: כל פרט בכתבה חייב להיות מתועד ואמיתי – אסור להמציא אירועים, ציטוטים או תיאורים. רק מה שידוע שקרה.`;

function getMockDraft(title: string, _description: string, _outline: string): string {
  return `זו טיוטת דוגמה לכתבה מלאה על הנושא: ${title}. כאן מופיע גוף הכתבה – לא השלד.

## הרקע לאירוע

בפסקה הזו מורחב הרעיון המרכזי עם פרטים קונקרטיים, תאריכים או דוגמאות מהחיים. הכתבה עצמה צריכה להיות ארוכה ומפורטת יותר מהשלד.

## מה קרה בפועל

פסקה נוספת פותחת זווית שנייה או מפתחת את אחת הנקודות מהשלד לטקסט רצוף וקריא.

## אחרי האירוע

לסיום – משפט או שניים שסוגרים את הכתבה ונותנים לקורא משהו לחשוב עליו.`;
}

/** טיוטה בודדת מ-OpenAI (ברירת מחדל) */
export async function generateDraft(
  config: WritingAgentConfig,
  title: string,
  description: string,
  outline: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return getMockDraft(title, description, outline);
  }
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });
  const systemPrompt = FIXED_WRITING_RULES + config.systemPrompt;
  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: DRAFT_USER_PROMPT(title, description, outline) },
    ],
    max_tokens: 4096,
  });
  const draft =
    res.choices[0]?.message?.content?.trim() ?? getMockDraft(title, description, outline);
  return draft;
}

/** טיוטה מ-OpenAI (לשימוש ב־generateAllDrafts) */
async function generateDraftOpenAI(
  config: WritingAgentConfig,
  title: string,
  description: string,
  outline: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return getMockDraft(title, description, outline);
  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });
  const systemPrompt = FIXED_WRITING_RULES + config.systemPrompt;
  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: DRAFT_USER_PROMPT(title, description, outline) },
    ],
    max_tokens: 4096,
  });
  return res.choices[0]?.message?.content?.trim() ?? getMockDraft(title, description, outline);
}

/** טיוטה מ-Gemini Mini */
async function generateDraftMini(
  config: WritingAgentConfig,
  title: string,
  description: string,
  outline: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return getMockDraft(title, description, outline);
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const systemPrompt = FIXED_WRITING_RULES + config.systemPrompt;
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    systemInstruction: systemPrompt,
  });
  const result = await model.generateContent(DRAFT_USER_PROMPT(title, description, outline));
  const text = result.response.text();
  return text?.trim() || getMockDraft(title, description, outline);
}

/** טיוטה מ-Anthropic (Claude) */
async function generateDraftCloud(
  config: WritingAgentConfig,
  title: string,
  description: string,
  outline: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return getMockDraft(title, description, outline);
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-20241022";
  const systemPrompt = FIXED_WRITING_RULES + config.systemPrompt;
  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: DRAFT_USER_PROMPT(title, description, outline),
      },
    ],
  });
  const textBlock = message.content.find((b) => (b as { type: string }).type === "text");
  const text =
    textBlock && "text" in textBlock && typeof (textBlock as { text?: string }).text === "string"
      ? (textBlock as { text: string }).text.trim()
      : undefined;
  return text || getMockDraft(title, description, outline);
}

export type DraftProvider = "openai" | "mini" | "cloud";

export interface AllDraftsResult {
  drafts: Partial<Record<DraftProvider, string>>;
  errors: Partial<Record<DraftProvider, string>>;
}

/** מריץ את שלושת המודלים במקביל – OpenAI, Mini (Gemini), Cloud – ומחזיר את כל הטיוטות */
export async function generateAllDrafts(
  config: WritingAgentConfig,
  title: string,
  description: string,
  outline: string
): Promise<AllDraftsResult> {
  const result: AllDraftsResult = { drafts: {}, errors: {} };

  const run = async (
    provider: DraftProvider,
    fn: () => Promise<string>
  ): Promise<void> => {
    try {
      const draft = await fn();
      result.drafts[provider] = draft;
    } catch (e) {
      result.errors[provider] = e instanceof Error ? e.message : "שגיאה ביצירת טיוטה";
    }
  };

  await Promise.all([
    run("openai", () => generateDraftOpenAI(config, title, description, outline)),
    run("mini", () => generateDraftMini(config, title, description, outline)),
    run("cloud", () => generateDraftCloud(config, title, description, outline)),
  ]);

  return result;
}
