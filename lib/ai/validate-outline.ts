import { webSearch, type WebSearchResult } from "./web-search";

export type OutlineItemStatus = "ok" | "warning" | "unsure";

export interface OutlineValidationSource {
  title: string;
  link: string;
}

export interface OutlineValidationItem {
  text: string;
  status: OutlineItemStatus;
  reason?: string;
  sources?: OutlineValidationSource[];
}

export interface OutlineValidationResult {
  items: OutlineValidationItem[];
  summary: string;
  allVerified: boolean;
  /** true אם האימות בוצע מול חיפוש ברשת (SERPER_API_KEY קיים) */
  usedWebSearch: boolean;
}

const MAX_CLAIMS = 8;
const SEARCH_RESULTS_PER_CLAIM = 4;

type OpenAIClient = InstanceType<typeof import("openai").default>;

/**
 * מנסה לחלץ ולפרסר JSON מתשובת מודל (לעיתים עטוף ב-markdown או עם טקסט נוסף).
 */
function parseJsonFromModelResponse<T>(raw: string): T | null {
  let s = raw.trim();
  // הסרת סימון קוד markdown
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```\s*$/;
  const match = s.match(codeBlock);
  if (match) s = match[1].trim();
  // חילוץ אובייקט JSON אם יש טקסט לפני/אחרי
  const firstBrace = s.indexOf("{");
  if (firstBrace !== -1) {
    let depth = 0;
    let end = -1;
    for (let i = firstBrace; i < s.length; i++) {
      if (s[i] === "{") depth++;
      else if (s[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end !== -1) s = s.slice(firstBrace, end + 1);
  }
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/**
 * מחלץ מטקסט הכתבה (שלד או טיוטה) טענות עובדתיות לבדיקה (כל טענה + שאילתת חיפוש מוצעת).
 */
async function extractClaims(
  openai: OpenAIClient,
  title: string,
  description: string,
  outlineText: string
): Promise<Array<{ text: string; searchQuery: string }>> {
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const prompt = `טקסט כתבה (כותרת: ${title}, תיאור: ${description}) – שלד או טיוטה מלאה:
---
${outlineText.slice(0, 3000)}
---

חלץ מהטקסט עד ${MAX_CLAIMS} טענות עובדתיות שכדאי לאמת ברשת: תאריכים, מספרים, שמות, אירועים, סטטיסטיקות. לכל טענה תן:
1. text – הצגת הטקסט הרלוונטי (משפט קצר).
2. searchQuery – שאילתת חיפוש אחת באנגלית או בעברית שמתאימה לאימות הטענה.

חשוב: החזר לפחות טענה אחת אם יש בטקסט עובדות. החזר JSON בלבד:
{"claims":[{"text":"...","searchQuery":"..."}]}`;

  const res = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: "אתה מחלץ טענות עובדתיות מטקסט כתבה (שלד או טיוטה). החזר JSON בלבד במבנה המבוקש. אם יש עובדות בטקסט – חלץ לפחות טענה אחת.",
      },
      { role: "user", content: prompt },
    ],
  });

  const raw = res.choices[0]?.message?.content?.trim();
  if (!raw) return [];

  const parsed = parseJsonFromModelResponse<{
    claims?: Array<{ text?: string; searchQuery?: string }>;
  }>(raw);
  if (!parsed) return [];
  const claims = (parsed.claims ?? [])
    .filter((c) => c && typeof c.text === "string" && typeof c.searchQuery === "string")
    .map((c) => ({ text: String(c.text).trim(), searchQuery: String(c.searchQuery).trim() }))
    .filter((c) => c.text && c.searchQuery)
    .slice(0, MAX_CLAIMS);
  return claims;
}

/**
 * שופט לכל טענה לפי תוצאות החיפוש: אושר / אזהרה / לא וודאי, ומקורות רלוונטיים.
 */
async function judgeClaimsWithSearchResults(
  openai: OpenAIClient,
  claimsWithResults: Array<{ text: string; searchQuery: string; results: WebSearchResult[] }>
): Promise<OutlineValidationItem[]> {
  if (claimsWithResults.length === 0) return [];

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const input = claimsWithResults
    .map(
      (c, i) =>
        `[${i + 1}] טענה: ${c.text}\nחיפוש: ${c.searchQuery}\nתוצאות:\n${c.results
          .map((r) => `- ${r.title}: ${r.snippet}\n  ${r.link}`)
          .join("\n")}`
    )
    .join("\n\n");

  const prompt = `בדוק כל טענה מול תוצאות החיפוש. לכל טענה קבע:
- "ok" – יש סימוכין בתוצאות (מקור תומך).
- "warning" – אין סימוכין ברורים או יש סתירה.
- "unsure" – לא ניתן להכריע לפי התוצאות.

בנוסף, לכל טענה בחר עד 2 מקורות רלוונטיים מהתוצאות (title + link) שתומכים או סותרים – רק אם יש.

החזר JSON בלבד:
{"items":[{"text":"טקסט הטענה","status":"ok|warning|unsure","reason":"סיבה קצרה בעברית רק ב-warning/unsure","sources":[{"title":"כותרת","link":"https://..."}]}]}

נתונים:
${input}`;

  const res = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "אתה בודק טענות מול תוצאות חיפוש. החזר JSON בלבד עם items, כל item עם text, status, reason (אופציונלי), sources (אופציונלי).",
      },
      { role: "user", content: prompt },
    ],
  });

  const raw = res.choices[0]?.message?.content?.trim();
  if (!raw) {
    return claimsWithResults.map((c) => ({
      text: c.text,
      status: "unsure" as OutlineItemStatus,
      reason: "לא התקבלה תשובה מהמערכת.",
    }));
  }

  const parsed = parseJsonFromModelResponse<{
    items?: Array<{
      text?: string;
      status?: string;
      reason?: string;
      sources?: Array<{ title?: string; link?: string }>;
    }>;
  }>(raw);
  if (parsed) {
    const items = parsed.items ?? [];
    return claimsWithResults.map((c, i) => {
      const item = items[i];
      const status =
        item?.status === "warning" || item?.status === "unsure" ? item.status : "ok";
      const sources: OutlineValidationSource[] = (item?.sources ?? [])
        .filter((s) => s && typeof s.link === "string")
        .map((s) => ({ title: String(s.title ?? "").trim() || "מקור", link: String(s.link).trim() }))
        .slice(0, 2);
      return {
        text: c.text,
        status: status as OutlineItemStatus,
        reason: item?.reason != null ? String(item.reason).trim() : undefined,
        sources: sources.length > 0 ? sources : undefined,
      };
    });
  }
  return claimsWithResults.map((c) => ({
    text: c.text,
    status: "unsure" as OutlineItemStatus,
    reason: "שגיאה בפענוח תשובת האימות.",
  }));
}

/**
 * אימות מבוסס LLM בלבד (ללא חיפוש ברשת). משמש גם כ־fallback כש־extractClaims מחזיר ריק.
 */
async function validateOutlineLlmOnly(
  openai: OpenAIClient,
  title: string,
  description: string,
  text: string
): Promise<OutlineValidationResult> {
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const prompt = `אתה בודק עובדתיות של טקסט כתבה (טיוטה או שלד). הרעיון: כותרת – ${title}. תיאור – ${description}.

טקסט הכתבה:
---
${text.slice(0, 3500)}
---

חלץ ולבדוק: לכל טענה עובדתית משמעותית (תאריכים, מספרים, שמות, אירועים, סטטיסטיקות) קבע:
- "ok" – נראה מבוסס, הגיוני, לא מומצא.
- "warning" – עלול להיות מומצא, מספר/תאריך/עובדה שצריך לבדוק במקור.
- "unsure" – לא ברור אם מבוסס או לא.

החזר JSON בלבד עם לפחות 1 פריט (עד 8):
{"items":[{"text":"טקסט הטענה","status":"ok|warning|unsure","reason":"סיבה קצרה בעברית רק ב-warning/unsure"}],"summary":"סיכום קצר בעברית – מה בסדר ומה לבדוק"}`;

  const res = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "אתה בודק עובדתיות של כתבה. זהה טענות עובדתיות ובדוק אם נראות מבוססות. החזר JSON בלבד במבנה המבוקש, עם items (לפחות פריט אחד) ו-summary.",
      },
      { role: "user", content: prompt },
    ],
  });

  const raw = res.choices[0]?.message?.content?.trim();
  if (!raw) {
    return {
      items: [{ text: text.slice(0, 200), status: "unsure", reason: "לא התקבלה תשובה מהמערכת." }],
      summary: "אימות לא הושלם.",
      allVerified: false,
      usedWebSearch: false,
    };
  }

  const parsed = parseJsonFromModelResponse<{
    items?: Array<{ text: string; status?: string; reason?: string }>;
    summary?: string;
  }>(raw);
  if (parsed) {
    const items: OutlineValidationItem[] = (parsed.items ?? [])
      .filter((x): x is { text: string; status?: string; reason?: string } => x && typeof x.text === "string")
      .map((x) => ({
        text: String(x.text).trim(),
        status: (x.status === "warning" || x.status === "unsure" ? x.status : "ok") as OutlineItemStatus,
        reason: x.reason != null ? String(x.reason).trim() : undefined,
      }))
      .slice(0, MAX_CLAIMS);

    const summary =
      typeof parsed.summary === "string"
        ? parsed.summary.trim() + (items.length === 0 ? " (לא זוהו טענות – נסה שוב.)" : "")
        : "אימות מבוסס הערכה בלבד. הוסף TAVILY_API_KEY או SERPER_API_KEY לאימות מול חיפוש ברשת.";
    const allVerified = items.length > 0 && items.every((i) => i.status === "ok");

    return {
      items: items.length > 0 ? items : [{ text: text.slice(0, 200), status: "unsure", reason: "לא זוהו טענות עובדתיות בתשובה." }],
      summary,
      allVerified,
      usedWebSearch: false,
    };
  }
  return {
    items: [{ text: text.slice(0, 200), status: "unsure", reason: "שגיאה בפענוח תשובת האימות." }],
    summary: "אימות לא הושלם.",
    allVerified: false,
    usedWebSearch: false,
  };
}

/**
 * אימות שלד/טיוטה מול חיפוש ברשת: חילוץ טענות → חיפוש → שיפוט לפי תוצאות.
 * אם TAVILY_API_KEY או SERPER_API_KEY לא מוגדרים – מחזיר אימות מבוסס LLM בלבד (ללא חיפוש).
 */
export async function validateOutline(
  title: string,
  description: string,
  outlineText: string
): Promise<OutlineValidationResult> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const text = (outlineText || "").trim();
  if (!text) {
    return { items: [], summary: "אין תוכן לאימות.", allVerified: true, usedWebSearch: false };
  }

  if (!openaiKey) {
    return {
      items: [{ text: text.slice(0, 200), status: "unsure", reason: "לא הוגדר OPENAI_API_KEY – לא בוצעה בדיקה." }],
      summary: "לא ניתן להריץ אימות.",
      allVerified: false,
      usedWebSearch: false,
    };
  }

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey: openaiKey });
  const hasWebSearch =
    Boolean(process.env.TAVILY_API_KEY?.trim()) || Boolean(process.env.SERPER_API_KEY?.trim());

  if (hasWebSearch) {
    // אימות אמיתי: חילוץ טענות → חיפוש ברשת → שיפוט
    const claims = await extractClaims(openai, title, description, text);
    if (claims.length === 0) {
      // חילוץ לא החזיר טענות – עוברים לאימות מבוסס LLM בלבד כדי שהמשתמש יקבל בדיקה
      return validateOutlineLlmOnly(openai, title, description, text);
    }

    const claimsWithResults = await Promise.all(
      claims.map(async (claim) => {
        const results = await webSearch(claim.searchQuery, {
          num: SEARCH_RESULTS_PER_CLAIM,
        });
        return { ...claim, results };
      })
    );

    const items = await judgeClaimsWithSearchResults(openai, claimsWithResults);
    const allVerified = items.length > 0 && items.every((i) => i.status === "ok");
    const verifiedCount = items.filter((i) => i.status === "ok").length;
    const summary =
      verifiedCount === items.length
        ? `אומתו ${items.length} טענות מול חיפוש ברשת.`
        : `${verifiedCount} מתוך ${items.length} טענות אומתו. מומלץ לבדוק את הסעיפים המסומנים.`;

    return { items, summary, allVerified, usedWebSearch: true };
  }

  return validateOutlineLlmOnly(openai, title, description, text);
}

/**
 * מעדכן שלד לפי תוצאות אימות: מחליף סעיפים עם status warning/unsure ב-[לבדיקה: סיבה] או בטקסט מתוקן מהמקורות.
 */
export async function reviseOutlineFromValidation(
  outlineText: string,
  validationResult: OutlineValidationResult
): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const text = (outlineText || "").trim();
  if (!text) return outlineText;
  const problemItems = validationResult.items.filter(
    (i) => i.status === "warning" || i.status === "unsure"
  );
  if (problemItems.length === 0) return outlineText;
  if (!openaiKey) return outlineText;

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey: openaiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const itemsBlock = problemItems
    .map(
      (i) =>
        `- "${i.text}" | סיבה: ${i.reason ?? "לא ודאי"}${i.sources?.length ? ` | מקורות: ${i.sources.map((s) => s.title || s.link).join(", ")}` : ""}`
    )
    .join("\n");

  const prompt = `שלד הכתבה הנוכחי:
---
${text.slice(0, 4000)}
---

הסעיפים הבאים דורשים תיקון (לפי אימות עובדות):
${itemsBlock}

עדכן את השלד: לכל סעיף בעייתי – החלף את הטקסט הרלוונטי ב-[לבדיקה: סיבה קצרה בעברית] או בטקסט מתוקן אם יש מקורות שמאפשרים תיקון. השאר את שאר השלד ללא שינוי.
החזר רק את השלד המעודכן במלואו, בלי הסברים או כותרות.`;

  const res = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "אתה מעדכן שלד כתבה לפי תוצאות אימות. החלף רק את הסעיפים הבעייתיים ב-[לבדיקה: סיבה] או בטקסט מתוקן. החזר את כל השלד המעודכן בלבד.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 1024,
  });

  const revised = res.choices[0]?.message?.content?.trim();
  return revised && revised.length > 0 ? revised : outlineText;
}
