/**
 * Wikipedia REST API – search and page summary.
 * Base: https://en.wikipedia.org/api/rest_v1/page/summary/
 * Search: https://en.wikipedia.org/w/rest.php/v1/search/page
 * Wikimedia requires a descriptive User-Agent.
 */
const WIKI_USER_AGENT = "NewsletterRAG/1.0 (documentation magazine; +https://github.com)";

export interface WikipediaPageSummary {
  title: string;
  /** URL-safe page key (e.g. Titanic). */
  key: string;
  extract: string;
  /** Canonical page URL. */
  url: string;
}

export interface WikipediaSearchHit {
  id: number;
  key: string;
  title: string;
  excerpt?: string;
  description?: string;
}

/**
 * Search English Wikipedia; returns page list with key/title/excerpt.
 */
export async function searchWikipedia(
  query: string,
  limit = 5
): Promise<WikipediaSearchHit[]> {
  const url = new URL("https://en.wikipedia.org/w/rest.php/v1/search/page");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("limit", String(Math.min(limit, 10)));

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": WIKI_USER_AGENT },
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { pages?: WikipediaSearchHit[] };
  return data.pages ?? [];
}

/**
 * Fetch page summary from English Wikipedia.
 * pageKey: URL-safe title (e.g. "Israel" or "Wreck_of_the_Titanic").
 */
export async function getWikipediaSummary(
  pageKey: string
): Promise<WikipediaPageSummary | null> {
  const encoded = encodeURIComponent(pageKey);
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;

  const res = await fetch(url, {
    headers: { "User-Agent": WIKI_USER_AGENT },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    title?: string;
    extract?: string;
    content_urls?: { desktop?: { page?: string } };
  };
  const extract = typeof data.extract === "string" ? data.extract.trim() : "";
  if (!extract) return null;

  const title = typeof data.title === "string" ? data.title : pageKey.replace(/_/g, " ");
  const urlPage =
    data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encoded}`;

  return {
    title,
    key: pageKey,
    extract,
    url: urlPage,
  };
}

/**
 * Search Wikipedia and fetch full summaries for the first N results.
 * Returns summaries suitable for RAG (snippet = extract).
 */
export async function searchWikipediaAndGetSummaries(
  query: string,
  maxPages = 3
): Promise<WikipediaPageSummary[]> {
  const pages = await searchWikipedia(query, maxPages);
  const summaries: WikipediaPageSummary[] = [];

  for (const p of pages.slice(0, maxPages)) {
    const summary = await getWikipediaSummary(p.key);
    if (summary) summaries.push(summary);
  }

  return summaries;
}
