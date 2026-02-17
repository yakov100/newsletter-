import type { Idea } from "./idea";
import type { IdeaValidation } from "@/lib/ai/validate-ideas";
import type { OutlineValidationResult } from "@/lib/ai/validate-outline";

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
  ideaValidation: IdeaValidation[] | null;
  outlineValidation: OutlineValidationResult | null;
  draftValidation: OutlineValidationResult | null;
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
