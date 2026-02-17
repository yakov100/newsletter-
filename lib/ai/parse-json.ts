/**
 * מנסה לחלץ ולפרסר JSON מתשובת מודל (לעיתים עטוף ב-markdown או עם טקסט נוסף).
 */
export function parseJsonFromModelResponse<T>(raw: string): T | null {
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
