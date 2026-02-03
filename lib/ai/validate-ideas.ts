export interface IdeaValidation {
  title: string;
  description: string;
  valid: boolean;
  reason?: string;
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
