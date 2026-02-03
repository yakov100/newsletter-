import type { Idea } from "./idea";

export type Stage =
  | "ideas"
  | "select"
  | "writing"
  | "editing"
  | "completion";

export interface WritingSession {
  stage: Stage;
  ideas: Idea[];
  selectedIdea: Idea | null;
  outline: string;
  draftContent: string;
  editedContent: string;
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
