export interface WebSearchResult {
  title: string;
  link: string;
  snippet: string;
}

// --- In-memory cache with 5-minute TTL + inflight deduplication ---
const CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_TIMEOUT_MS = 8_000;

interface CacheEntry {
  results: WebSearchResult[];
  expiresAt: number;
}

const searchCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<WebSearchResult[]>>();

function cacheKey(query: string, num: number): string {
  return `${query}::${num}`;
}

function getCached(key: string): WebSearchResult[] | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    searchCache.delete(key);
    return null;
  }
  return entry.results;
}

function setCache(key: string, results: WebSearchResult[]): void {
  searchCache.set(key, { results, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * חיפוש ברשת – תומך ב־Tavily (מומלץ) או Serper.
 * דורש TAVILY_API_KEY או SERPER_API_KEY ב־.env.local.
 * עדיפות ל־Tavily אם שניהם מוגדרים.
 *
 * כולל: cache עם TTL של 5 דקות, inflight deduplication, ו-timeout של 8 שניות.
 */
export async function webSearch(
  query: string,
  options?: { num?: number }
): Promise<WebSearchResult[]> {
  const num = Math.min(Math.max(options?.num ?? 5, 1), 10);
  const key = cacheKey(query, num);

  // Check cache first
  const cached = getCached(key);
  if (cached) return cached;

  // Inflight deduplication: if same query is already in-flight, wait for it
  const inflight = inflightRequests.get(key);
  if (inflight) return inflight;

  const promise = executeSearch(query, num);
  inflightRequests.set(key, promise);

  try {
    const results = await promise;
    setCache(key, results);
    return results;
  } finally {
    inflightRequests.delete(key);
  }
}

async function executeSearch(query: string, num: number): Promise<WebSearchResult[]> {
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
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
      signal: controller.signal,
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
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/** Serper (Google Search API) – גיבוי אם Tavily לא מוגדר */
async function serperSearch(
  query: string,
  num: number,
  apiKey: string
): Promise<WebSearchResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const res = await fetch("https://serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({ q: query, num }),
      signal: controller.signal,
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
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
