import type { WritingAgentConfig } from "@/lib/agent-config";

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

אל תוסיף הקדמה, משפטי מעבר או הסברים: לא "תבסס על המידע מהחיפוש", לא "הנה הכתבה המלאה", לא "להלן הכתבה" – התחל ישירות בגוף הכתבה (פסקה ראשונה או כותרת ##).

כותרות בגוף הכתבה: הוסף 3–4 כותרות משנה קצרות וקליטות שמפצלות את הכתבה לחלקים ברורים (לא "פתיחה" או "סיום" – כותרות תוכן). כל כותרת בשורה נפרדת עם הסימן ## בהתחלה, ואחריה שורה ריקה. דוגמה: ## מה בדיוק קרה שם. הכותרות יוצגו בעיצוב בולט בעורך.

חשוב: כל פרט בכתבה חייב להיות מתועד ואמיתי – אסור להמציא אירועים, ציטוטים או תיאורים. רק מה שידוע שקרה.`;

/** מסיר מהתחלת הטיוטה משפטי הקדמה שהמודל לפעמים מוסיף (חיפוש, "הנה הכתבה" וכו') */
function stripPreamble(draft: string): string {
  const t = draft.trim();
  if (!t) return t;
  const preamblePatterns = [
    /^תבסס\s*על\s*המידע\s*שקיבלתי\s*מהחיפוש,?\s*הנה\s*הכתבה\s*המלאה:?\s*[\n\r]*/i,
    /^תבסס\s*על\s*המידע\s*מהחיפוש,?\s*הנה\s*הכתבה\s*המלאה:?\s*[\n\r]*/i,
    /^הנה\s*הכתבה\s*המלאה:?\s*[\n\r]*/i,
    /^להלן\s*הכתבה:?\s*[\n\r]*/i,
    /^Based on the information (I )?received from the search,?\s*here is the full article:?\s*[\n\r]*/i,
  ];
  let out = t;
  for (const p of preamblePatterns) {
    out = out.replace(p, "").trim();
  }
  return out || t;
}

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
  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: config.systemPrompt },
      { role: "user", content: DRAFT_USER_PROMPT(title, description, outline) },
    ],
    max_tokens: 4096,
  });
  const raw =
    res.choices[0]?.message?.content?.trim() ?? getMockDraft(title, description, outline);
  const draft = stripPreamble(raw);
  return draft.length > 50 ? draft : getMockDraft(title, description, outline);
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
  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      { role: "system", content: config.systemPrompt },
      { role: "user", content: DRAFT_USER_PROMPT(title, description, outline) },
    ],
    max_tokens: 4096,
  });
  const raw =
    res.choices[0]?.message?.content?.trim() ?? getMockDraft(title, description, outline);
  const draft = stripPreamble(raw);
  return draft.length > 50 ? draft : getMockDraft(title, description, outline);
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
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    systemInstruction: config.systemPrompt,
  });
  const result = await model.generateContent(DRAFT_USER_PROMPT(title, description, outline));
  const raw = result.response.text()?.trim() || getMockDraft(title, description, outline);
  const draft = stripPreamble(raw);
  return draft.length > 50 ? draft : getMockDraft(title, description, outline);
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
  const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: config.systemPrompt,
    tools: [
      { type: "web_search_20250305", name: "web_search", max_uses: 5 },
    ],
    messages: [
      {
        role: "user",
        content: DRAFT_USER_PROMPT(title, description, outline),
      },
    ],
  });
  const textBlock = message.content.find((b) => (b as { type: string }).type === "text");
  const raw =
    textBlock && "text" in textBlock && typeof (textBlock as { text?: string }).text === "string"
      ? (textBlock as { text: string }).text.trim()
      : "";
  const draft = stripPreamble(raw || getMockDraft(title, description, outline));
  return draft.length > 50 ? draft : getMockDraft(title, description, outline);
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
