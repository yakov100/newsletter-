import { createResponseWithWebSearch } from "./responses-web-search";
import { parseJsonFromModelResponse } from "./parse-json";
import { webSearch, type WebSearchResult } from "./web-search";

export interface IdeaValidation {
  title: string;
  description: string;
  valid: boolean;
  reason?: string;
  confidence: number; // 0-100: how much documentation/evidence found online
}

const SEARCH_RESULTS_PER_IDEA = 4;

type OpenAIClient = InstanceType<typeof import("openai").default>;

/**
 * שופט כל רעיון מול תוצאות החיפוש: valid (יש סימוכין/סיפור אמיתי) או invalid + reason.
 */
async function judgeIdeasWithSearchResults(
  openai: OpenAIClient,
  ideasWithResults: Array<{
    title: string;
    description: string;
    results: WebSearchResult[];
  }>
): Promise<IdeaValidation[]> {
  if (ideasWithResults.length === 0) return [];

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const input = ideasWithResults
    .map(
      (item, i) =>
        `[${i + 1}] כותרת: ${item.title}\n   תיאור: ${item.description ?? "-"}\n   תוצאות חיפוש:\n${item.results
          .map((r) => `   - ${r.title}: ${r.snippet}\n     ${r.link}`)
          .join("\n")}`
    )
    .join("\n\n");

  const prompt = `בדוק כל רעיון לכתבה מול תוצאות החיפוש. לכל רעיון קבע:
- valid: true – יש סימוכין ברשת (הסיפור/הנושא אמיתי, מתועד, לא מומצא).
- valid: false – אין סימוכין, מומצא, או לא רלוונטי; תן reason קצר בעברית.
- confidence: מספר 0-100 שמייצג כמה תיעוד ומקורות נמצאו ברשת (0 = לא נמצא כלום, 100 = מתועד היטב).

החזר JSON בלבד:
{"results":[{"title":"כותרת","description":"תיאור","valid":true או false,"reason":"סיבה קצרה בעברית רק אם valid=false","confidence":75}]}

נתונים:
${input}`;

  const res = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "אתה בודק רעיונות לכתבות מול תוצאות חיפוש ברשת. היה חשדן — אל תסמן רעיון כ-valid אלא אם מצאת ראיות ברורות בתוצאות החיפוש. שאל את עצמך: \"האם תוצאות החיפוש באמת מאשרות שהסיפור הזה קרה?\" אם התוצאות לא רלוונטיות או עמומות — סמן כ-false עם reason. החזר JSON בלבד במבנה results, כל איבר עם title, description, valid, reason (אופציונלי), confidence.",
      },
      { role: "user", content: prompt },
    ],
  });

  const content = res.choices[0]?.message?.content?.trim();
  if (!content) {
    return ideasWithResults.map((item) => ({
      title: item.title,
      description: item.description ?? "",
      valid: true,
      reason: undefined,
      confidence: 50,
    }));
  }

  try {
    const parsed = JSON.parse(content) as { results?: IdeaValidation[] };
    const results = parsed.results ?? [];
    return ideasWithResults.map((item, i) => {
      const r = results[i];
      return {
        title: item.title,
        description: item.description ?? "",
        valid: r ? Boolean(r.valid) : true,
        reason: r?.reason,
        confidence: typeof r?.confidence === "number" ? Math.max(0, Math.min(100, r.confidence)) : (r?.valid ? 70 : 20),
      };
    });
  } catch {
    return ideasWithResults.map((item) => ({
      title: item.title,
      description: item.description ?? "",
      valid: true,
      reason: undefined,
      confidence: 50,
    }));
  }
}

/**
 * אימות רעיונות באמצעות Responses API + web_search – המודל מחפש ברשת ומונע הזיות.
 */
async function validateIdeasWithResponsesWebSearch(
  openai: OpenAIClient,
  ideas: Array<{ title: string; description?: string }>
): Promise<IdeaValidation[] | null> {
  const list = ideas
    .map((i, idx) => `[${idx + 1}] כותרת: ${i.title}\n   תיאור: ${i.description ?? "-"}`)
    .join("\n\n");
  const instructions = `בדוק כל רעיון לכתבה: השתמש בכלי חיפוש ברשת כדי לאמת אם הסיפור/הנושא אמיתי ומתועד. אל תמציא – רק מה שמצאת בחיפוש. החזר JSON בלבד: {"results":[{"title":"כותרת","description":"תיאור","valid":true או false,"reason":"סיבה קצרה בעברית רק אם valid=false","confidence":75}]}. valid: true רק אם יש סימוכין ברשת. confidence: מספר 0-100 שמייצג כמה תיעוד נמצא ברשת.`;
  const input = `רעיונות לבדיקה:\n${list}`;

  try {
    const { outputText } = await createResponseWithWebSearch(openai, input, {
      instructions,
      maxOutputTokens: 1024,
    });
    const parsed = parseJsonFromModelResponse<{ results?: IdeaValidation[] }>(outputText);
    const results = parsed?.results ?? [];
    if (results.length === 0) return null;
    return ideas.map((item, i) => {
      const r = results[i];
      return {
        title: item.title,
        description: item.description ?? "",
        valid: r ? Boolean(r.valid) : true,
        reason: r?.reason,
        confidence: typeof r?.confidence === "number" ? Math.max(0, Math.min(100, r.confidence)) : (r?.valid ? 70 : 20),
      };
    });
  } catch {
    return null;
  }
}

export async function validateIdeas(
  ideas: Array<{ title: string; description?: string }>
): Promise<IdeaValidation[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!ideas.length) return [];

  if (!apiKey) {
    return ideas.map((i) => ({
      title: i.title,
      description: i.description ?? "",
      valid: true,
      reason: "לא הוגדר OPENAI_API_KEY – לא בוצעה בדיקה.",
      confidence: 0,
    }));
  }

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });

  const responsesResult = await validateIdeasWithResponsesWebSearch(openai, ideas);
  if (responsesResult) return responsesResult;

  const hasWebSearch =
    Boolean(process.env.TAVILY_API_KEY?.trim()) ||
    Boolean(process.env.SERPER_API_KEY?.trim());

  if (hasWebSearch) {
    const ideasWithResults = await Promise.all(
      ideas.map(async (idea) => {
        const query = [idea.title, idea.description ?? ""].filter(Boolean).join(" ").trim();
        const results =
          query.length > 0
            ? await webSearch(query, { num: SEARCH_RESULTS_PER_IDEA })
            : [];
        return {
          title: idea.title,
          description: idea.description ?? "",
          results,
        };
      })
    );
    return judgeIdeasWithSearchResults(openai, ideasWithResults);
  }

  // fallback: אימות מבוסס LLM בלבד (בלי חיפוש)
  const list = ideas
    .map((i, idx) => `${idx + 1}. כותרת: ${i.title}\n   תיאור: ${i.description ?? "-"}`)
    .join("\n\n");

  const prompt = `נתונה רשימת רעיונות לכתבה/ניוזלטר. לכל רעיון (כותרת + תיאור) קבע אם הוא נכון ורלוונטי – כלומר הגיוני, מתאים לכתבה, לא מומצא או לא קשור. אם הרעיון לא ברור, גנרי מדי או לא מתאים – סמן כלא רלוונטי עם סיבה קצרה. בנוסף, תן ציון confidence (0-100) שמייצג כמה הנושא מתועד וידוע.

חזור ב-JSON בלבד:
{"results":[{"title":"כותרת","description":"תיאור","valid":true או false,"reason":"סיבה קצרה בעברית רק אם valid=false","confidence":75}]}

רעיונות:
${list}`;

  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "אתה בודק רלוונטיות ואמינות של רעיונות לכתבות. לכל רעיון שאל את עצמך: \"האם אני באמת יודע שזה קרה? האם השמות והתאריכים מוכרים לי ממקורות אמיתיים?\" אם אתה לא בטוח — סמן כ-false ותן confidence נמוך. עדיף לפסול רעיון טוב מלאשר רעיון מומצא. החזר JSON בלבד במבנה המבוקש.",
      },
      { role: "user", content: prompt },
    ],
  });

  const content = res.choices[0]?.message?.content?.trim();
  if (!content) {
    return ideas.map((i) => ({
      title: i.title,
      description: i.description ?? "",
      valid: true,
      reason: undefined,
      confidence: 50,
    }));
  }

  try {
    const parsed = JSON.parse(content) as { results?: IdeaValidation[] };
    const results = parsed.results ?? [];
    return ideas.map((item, i) => {
      const r = results[i];
      return {
        title: item.title,
        description: item.description ?? "",
        valid: r ? Boolean(r.valid) : true,
        reason: r?.reason,
        confidence: typeof r?.confidence === "number" ? Math.max(0, Math.min(100, r.confidence)) : (r?.valid ? 70 : 20),
      };
    });
  } catch {
    return ideas.map((i) => ({
      title: i.title,
      description: i.description ?? "",
      valid: true,
      reason: undefined,
      confidence: 50,
    }));
  }
}
