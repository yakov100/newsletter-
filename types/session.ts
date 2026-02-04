import type { Idea } from "./idea";

export type Stage =
  | "ideas"
  | "select"
  | "writing"
  | "editing"
  | "completion";

export interface AllDraftsState {
  drafts: Record<string, string>;
  errors: Record<string, string>;
}

export interface WritingSession {
  stage: Stage;
  ideas: Idea[];
  selectedIdea: Idea | null;
  outline: string;
  draftContent: string;
  editedContent: string;
  draftLoading: boolean;
  allDrafts: AllDraftsState | null;
  createdAt: number;
  updatedAt: number;
}

export type { Idea };
export const STAGES: Stage[] = [
  "ideas",
  "select",
  "writing",
  "editing",
  "completion",
];
