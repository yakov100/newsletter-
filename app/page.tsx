"use client";

import { SessionProvider, useSession } from "@/lib/state/session-context";
import type { Stage } from "@/types/session";
import { IdeasStage } from "@/components/stages/IdeasStage";
import { SelectIdeaStage } from "@/components/stages/SelectIdeaStage";
import { WritingStage } from "@/components/stages/WritingStage";
import { EditingStage } from "@/components/stages/EditingStage";
import { CompletionStage } from "@/components/stages/CompletionStage";
import Link from "next/link";

const STAGE_LABELS: Record<Stage, string> = {
  ideas: "רעיונות",
  select: "בחירה",
  writing: "כתיבה",
  editing: "עריכה",
  completion: "סיום",
};

function StageIndicator({ current }: { current: Stage }) {
  const { goToStage } = useSession();
  const stages: Stage[] = ["ideas", "select", "writing", "editing", "completion"];
  const i = stages.indexOf(current);
  const prevStage = i > 0 ? stages[i - 1] : null;

  return (
    <nav
      className="flex items-center justify-center gap-0 sm:gap-2 py-6 px-4 border-b border-[var(--border)] bg-[var(--card)]/60 backdrop-blur-sm"
      aria-label="שלבים"
    >
      {prevStage && (
        <button
          type="button"
          onClick={() => goToStage(prevStage)}
          className="mr-2 sm:mr-4 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-subtle)] transition-colors"
          aria-label="חזור לשלב הקודם"
        >
          <span aria-hidden>←</span>
          <span className="hidden sm:inline">חזור</span>
        </button>
      )}
      <div className="flex items-center gap-1 sm:gap-3 max-w-2xl w-full justify-center flex-wrap">
        {stages.map((s, j) => {
          const isActive = j === i;
          const isPast = j < i;
          return (
            <div key={s} className="flex items-center">
              <button
                type="button"
                onClick={() => goToStage(s)}
                className={
                  "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 " +
                  (isActive
                    ? "bg-[var(--accent)] text-white shadow-md cursor-default"
                    : isPast
                      ? "bg-[var(--accent-light)] text-[var(--accent-dark)] dark:bg-[var(--accent-dark)]/20 dark:text-[var(--accent)] hover:opacity-90 cursor-pointer"
                      : "text-[var(--foreground-muted)] bg-transparent hover:bg-[var(--background-subtle)] hover:text-[var(--foreground)] cursor-pointer")
                }
                aria-current={isActive ? "step" : undefined}
                aria-label={`${STAGE_LABELS[s]}${isActive ? " (נוכחי)" : ""}`}
              >
                <span
                  className={
                    "flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold " +
                    (isActive ? "bg-white/25" : isPast ? "bg-[var(--accent)]/30" : "bg-[var(--border)]")
                  }
                >
                  {j + 1}
                </span>
                <span className="hidden sm:inline">{STAGE_LABELS[s]}</span>
              </button>
              {j < stages.length - 1 && (
                <span
                  className={
                    "mx-0.5 sm:mx-1 w-4 sm:w-8 h-0.5 rounded " +
                    (j < i ? "bg-[var(--accent)]" : "bg-[var(--border)]")
                  }
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function MainContent() {
  const { session } = useSession();
  const { stage } = session;

  return (
    <>
      <StageIndicator current={stage} />
      <main className="px-4 sm:px-6 pb-20 pt-8 max-w-4xl mx-auto w-full">
        {stage === "ideas" && <IdeasStage />}
        {stage === "select" && <SelectIdeaStage />}
        {stage === "writing" && <WritingStage />}
        {stage === "editing" && <EditingStage />}
        {stage === "completion" && <CompletionStage />}
      </main>
    </>
  );
}

export default function Home() {
  return (
    <SessionProvider>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-md shadow-[var(--shadow)]">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight gradient-text hover:opacity-90 transition-opacity"
          >
            מערכת כתיבה חכמה
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/settings"
              className="text-sm font-medium px-3 py-2 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-subtle)] transition-colors"
            >
              הגדרות
            </Link>
            <Link
              href="/auth"
              className="text-sm font-medium px-3 py-2 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-subtle)] transition-colors"
            >
              התחבר
            </Link>
          </nav>
        </header>
        <MainContent />
      </div>
    </SessionProvider>
  );
}
