"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Idea } from "@/types/idea";
import type { Stage, WritingSession } from "@/types/session";

const initialSession: WritingSession = {
  stage: "ideas",
  ideas: [],
  selectedIdea: null,
  outline: "",
  draftContent: "",
  editedContent: "",
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
