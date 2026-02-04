export interface WebSearchResult {
  title: string;
  link: string;
  snippet: string;
}

/**
 * חיפוש ברשת – תומך ב־Tavily (מומלץ) או Serper.
 * דורש TAVILY_API_KEY או SERPER_API_KEY ב־.env.local.
 * עדיפות ל־Tavily אם שניהם מוגדרים.
 */
export async function webSearch(
  query: string,
  options?: { num?: number }
): Promise<WebSearchResult[]> {
  const num = Math.min(Math.max(options?.num ?? 5, 1), 10);

  // עדיפות ל־Tavily (אתר פעיל, מתאים ל־LLM)
  const tavilyKey = process.env.TAVILY_API_KEY?.trim();
  if (tavilyKey) {
    return tavilySearch(query, num, tavilyKey);
  }

  const serperKey = process.env.SERPER_API_KEY?.trim();
  if (serperKey) {
    return serperSearch(query, num, serperKey);
  }

  return [];
}

/** Tavily Search API – https://api.tavily.com/search */
async function tavilySearch(
  query: string,
  maxResults: number,
  apiKey: string
): Promise<WebSearchResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
      search_depth: "basic",
      include_answer: false,
    }),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  const results = data.results ?? [];
  return results
    .filter((r) => r && (r.url || r.title))
    .map((r) => ({
      title: String(r.title ?? "").trim() || "ללא כותרת",
      link: String(r.url ?? "").trim(),
      snippet: String(r.content ?? "").trim(),
    }))
    .filter((r) => r.link);
}

/** Serper (Google Search API) – גיבוי אם Tavily לא מוגדר */
async function serperSearch(
  query: string,
  num: number,
  apiKey: string
): Promise<WebSearchResult[]> {
  const res = await fetch("https://serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({ q: query, num }),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  const organic = data.organic ?? [];
  return organic
    .filter((r) => r && (r.link || r.title))
    .map((r) => ({
      title: String(r.title ?? "").trim() || "ללא כותרת",
      link: String(r.link ?? "").trim(),
      snippet: String(r.snippet ?? "").trim(),
    }))
    .filter((r) => r.link);
}
