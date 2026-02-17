"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Idea } from "@/types/idea";
import type { Stage, WritingSession, AllDraftsState } from "@/types/session";
import type { IdeaValidation } from "@/lib/ai/validate-ideas";
import type { OutlineValidationResult } from "@/lib/ai/validate-outline";

const initialSession: WritingSession = {
  stage: "ideas",
  ideas: [],
  selectedIdea: null,
  outline: "",
  draftContent: "",
  editedContent: "",
  draftLoading: false,
  allDrafts: null,
  ideaValidation: null,
  outlineValidation: null,
  draftValidation: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

type SessionContextValue = {
  session: WritingSession;
  setIdeas: (ideas: Idea[]) => void;
  selectIdea: (idea: Idea | null) => void;
  setOutline: (outline: string) => void;
  setDraftContent: (content: string) => void;
  setEditedContent: (content: string) => void;
  setDraftLoading: (loading: boolean) => void;
  setAllDrafts: (state: AllDraftsState | null) => void;
  setIdeaValidation: (v: IdeaValidation[] | null) => void;
  setOutlineValidation: (v: OutlineValidationResult | null) => void;
  setDraftValidation: (v: OutlineValidationResult | null) => void;
  goToStage: (stage: Stage) => void;
  resetSession: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<WritingSession>(initialSession);

  const setIdeas = useCallback((ideas: Idea[]) => {
    setSession((prev) => ({
      ...prev,
      ideas,
      stage: "select",
      updatedAt: Date.now(),
    }));
  }, []);

  const selectIdea = useCallback((idea: Idea | null) => {
    setSession((prev) => ({
      ...prev,
      selectedIdea: idea,
      updatedAt: Date.now(),
    }));
  }, []);

  const setOutline = useCallback((outline: string) => {
    setSession((prev) => ({
      ...prev,
      outline,
      updatedAt: Date.now(),
    }));
  }, []);

  const setDraftContent = useCallback((content: string) => {
    setSession((prev) => ({
      ...prev,
      draftContent: content,
      updatedAt: Date.now(),
    }));
  }, []);

  const setEditedContent = useCallback((content: string) => {
    setSession((prev) => ({
      ...prev,
      editedContent: content,
      updatedAt: Date.now(),
    }));
  }, []);

  const setDraftLoading = useCallback((loading: boolean) => {
    setSession((prev) => ({
      ...prev,
      draftLoading: loading,
      updatedAt: Date.now(),
    }));
  }, []);

  const setAllDrafts = useCallback((state: AllDraftsState | null) => {
    setSession((prev) => ({
      ...prev,
      allDrafts: state,
      updatedAt: Date.now(),
    }));
  }, []);

  const setIdeaValidation = useCallback((v: IdeaValidation[] | null) => {
    setSession((prev) => ({
      ...prev,
      ideaValidation: v,
      updatedAt: Date.now(),
    }));
  }, []);

  const setOutlineValidation = useCallback((v: OutlineValidationResult | null) => {
    setSession((prev) => ({
      ...prev,
      outlineValidation: v,
      updatedAt: Date.now(),
    }));
  }, []);

  const setDraftValidation = useCallback((v: OutlineValidationResult | null) => {
    setSession((prev) => ({
      ...prev,
      draftValidation: v,
      updatedAt: Date.now(),
    }));
  }, []);

  const goToStage = useCallback((stage: Stage) => {
    setSession((prev) => {
      const next = { ...prev, stage, updatedAt: Date.now() };
      if (stage === "editing" && !prev.editedContent && prev.draftContent) {
        next.editedContent = prev.draftContent;
      }
      return next;
    });
  }, []);

  const resetSession = useCallback(() => {
    setSession({
      ...initialSession,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }, []);

  const value = useMemo(
    () => ({
      session,
      setIdeas,
      selectIdea,
      setOutline,
      setDraftContent,
      setEditedContent,
      setDraftLoading,
      setAllDrafts,
      setIdeaValidation,
      setOutlineValidation,
      setDraftValidation,
      goToStage,
      resetSession,
    }),
    [
      session,
      setIdeas,
      selectIdea,
      setOutline,
      setDraftContent,
      setEditedContent,
      setDraftLoading,
      setAllDrafts,
      setIdeaValidation,
      setOutlineValidation,
      setDraftValidation,
      goToStage,
      resetSession,
    ]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
