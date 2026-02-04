import { webSearch, type WebSearchResult } from "./web-search";
import { searchWikipediaAndGetSummaries } from "./wikipedia";

export interface IdeaValidation {
  title: string;
  description: string;
  valid: boolean;
  reason?: string;
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

  const prompt = `בדוק כל רעיון לכתבה מול תוצאות החיפוש והמקורות (כולל ויקיפדיה אם צורף). לכל רעיון קבע:
- valid: true – יש סימוכין ברשת או בוויקיפדיה (הסיפור/הנושא אמיתי, מתועד, לא מומצא).
- valid: false – אין סימוכין, מומצא, או לא רלוונטי; תן reason קצר בעברית.

החזר JSON בלבד:
{"results":[{"title":"כותרת","description":"תיאור","valid":true או false,"reason":"סיבה קצרה בעברית רק אם valid=false"}]}

נתונים:
${input}`;

  const res = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "אתה בודק רעיונות לכתבות מול תוצאות חיפוש ווויקיפדיה. החזר JSON בלבד במבנה results, כל איבר עם title, description, valid, reason (אופציונלי).",
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
      };
    });
  } catch {
    return ideasWithResults.map((item) => ({
      title: item.title,
      description: item.description ?? "",
      valid: true,
      reason: undefined,
    }));
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
    }));
  }

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });

  const hasWebSearch =
    Boolean(process.env.TAVILY_API_KEY?.trim()) ||
    Boolean(process.env.SERPER_API_KEY?.trim());

  if (hasWebSearch) {
    const ideasWithResults = await Promise.all(
      ideas.map(async (idea) => {
        const query = [idea.title, idea.description ?? ""].filter(Boolean).join(" ").trim();
        const results: WebSearchResult[] =
          query.length > 0
            ? await webSearch(query, { num: SEARCH_RESULTS_PER_IDEA })
            : [];

        // Add Wikipedia summary as extra evidence (en.wikipedia.org)
        if (query.length > 0) {
          try {
            const wikiSummaries = await searchWikipediaAndGetSummaries(query, 1);
            if (wikiSummaries.length > 0) {
              const w = wikiSummaries[0];
              results.unshift({
                title: `ויקיפדיה: ${w.title}`,
                link: w.url,
                snippet: w.extract.slice(0, 500),
              });
            }
          } catch {
            // Skip Wikipedia on network/API errors
          }
        }

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

  const prompt = `נתונה רשימת רעיונות לכתבה/ניוזלטר. לכל רעיון (כותרת + תיאור) קבע אם הוא נכון ורלוונטי – כלומר הגיוני, מתאים לכתבה, לא מומצא או לא קשור. אם הרעיון לא ברור, גנרי מדי או לא מתאים – סמן כלא רלוונטי עם סיבה קצרה.

חזור ב-JSON בלבד:
{"results":[{"title":"כותרת","description":"תיאור","valid":true או false,"reason":"סיבה קצרה בעברית רק אם valid=false"}]}

רעיונות:
${list}`;

  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "אתה בודק רלוונטיות של רעיונות לכתבות. החזר JSON בלבד במבנה המבוקש.",
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
      };
    });
  } catch {
    return ideas.map((i) => ({
      title: i.title,
      description: i.description ?? "",
      valid: true,
      reason: undefined,
    }));
  }
}
