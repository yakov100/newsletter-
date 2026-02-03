function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export interface SuggestionValidation {
  suggestion: string;
  valid: boolean;
  reason?: string;
}

export async function validateSuggestions(
  draftHtml: string,
  suggestions: string[]
): Promise<SuggestionValidation[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  const text = stripHtml(draftHtml);
  if (!suggestions.length) return [];

  if (!apiKey) {
    return suggestions.map((s) => ({
      suggestion: s,
      valid: true,
      reason: "לא הוגדר OPENAI_API_KEY – לא בוצעה בדיקה.",
    }));
  }

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey });

  const prompt = `נתונה טיוטת כתבה ורשימת הצעות לשיפור. לכל הצעה קבע אם היא נכונה ורלוונטית לטקסט (כלומר באמת מתאימה לתוכן ולסגנון) או לא רלוונטית/מומצאת.

חזור ב-JSON בלבד, במבנה:
{"results":[{"suggestion":"טקסט ההצעה","valid":true או false,"reason":"סיבה קצרה בעברית אם valid=false"}]}

טיוטה:
${text.slice(0, 3000)}

הצעות:
${suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;

  const res = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "אתה בודק רלוונטיות של הצעות עריכה לטקסט. החזר JSON בלבד במבנה המבוקש.",
      },
      { role: "user", content: prompt },
    ],
  });

  const content = res.choices[0]?.message?.content?.trim();
  if (!content) {
    return suggestions.map((s) => ({ suggestion: s, valid: true, reason: undefined }));
  }

  try {
    const parsed = JSON.parse(content) as { results?: SuggestionValidation[] };
    const results = parsed.results ?? [];
    if (results.length !== suggestions.length) {
      return suggestions.map((s, i) => ({
        suggestion: s,
        valid: results[i]?.valid ?? true,
        reason: results[i]?.reason,
      }));
    }
    return results.map((r, i) => ({
      suggestion: r.suggestion ?? suggestions[i],
      valid: Boolean(r.valid),
      reason: r.reason,
    }));
  } catch {
    return suggestions.map((s) => ({ suggestion: s, valid: true, reason: undefined }));
  }
}
