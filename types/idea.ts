export type IdeaConfidenceLevel = "high" | "medium" | "low";

export interface IdeaSource {
  id: string;
  title: string;
  link: string;
  snippet?: string;
}

export interface Idea {
  id: string;
  title: string;
  description: string;
  /** IDs of sources from RAG retrieval (e.g. s1, s2). */
  sourceIds?: string[];
  /** Full source details for UI (e.g. "בדוק מקור"). */
  sources?: IdeaSource[];
  /** From validate-ideas or LLM response. */
  verified?: boolean;
  /** From LLM response; low / no sourceIds → treat as draft. */
  confidenceLevel?: IdeaConfidenceLevel;
}
