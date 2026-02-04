"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/state/session-context";
import type { Idea } from "@/types/idea";

function randomId(): string {
  return crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface IdeaValidation {
  title: string;
  description: string;
  valid: boolean;
  reason?: string;
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "ביטחון: גבוה",
  medium: "ביטחון: בינוני",
  low: "ביטחון: נמוך / לבדיקה",
};

function IdeaCard({
  idea,
  selected,
  onSelect,
  validation,
}: {
  idea: Idea;
  selected: boolean;
  onSelect: () => void;
  validation?: IdeaValidation;
}) {
  const hasSources = idea.sources && idea.sources.length > 0;
  const confidenceLabel =
    idea.confidenceLevel && CONFIDENCE_LABELS[idea.confidenceLevel];

  return (
    <div
      className={
        "flex flex-col overflow-hidden rounded-xl transition-all " +
        (selected
          ? "border-2 border-[var(--primary)] bg-card shadow-lg shadow-[var(--primary)]/10"
          : "border border-border bg-card hover:border-[var(--primary)]/50")
      }
    >
      <div className="flex flex-1 flex-col gap-3 p-5 text-right">
        <h3 className="text-lg font-bold leading-snug text-foreground">{idea.title}</h3>
        <p className="flex-1 text-sm font-normal leading-relaxed text-muted">
          {idea.description}
        </p>
        {hasSources && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted">מקורות:</span>
            {idea.sources!.slice(0, 3).map((src) => (
              <a
                key={src.id}
                href={src.link}
                target="_blank"
                rel="noopener noreferrer"
                title={src.title}
                className="inline-flex items-center gap-1 rounded border border-[var(--primary)]/30 bg-[var(--primary)]/5 px-2 py-1 text-xs font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/15"
              >
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                בדוק מקור
              </a>
            ))}
          </div>
        )}
        {!hasSources && !idea.sourceIds?.length && (
          <p className="text-xs font-medium text-amber-400">ללא מקור – נדרש אימות</p>
        )}
        {confidenceLabel && (
          <p className="text-xs font-medium text-muted">{confidenceLabel}</p>
        )}
        {validation !== undefined && (
          <p
            className={`text-xs font-medium ${
              validation.valid ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {validation.valid
              ? "✓ נכון, רלוונטי"
              : `לא רלוונטי${validation.reason ? `: ${validation.reason}` : ""}`}
          </p>
        )}
        <button
          type="button"
          onClick={onSelect}
          className={
            "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors " +
            (selected
              ? "bg-[var(--primary)] text-white"
              : "bg-[var(--primary)] text-white hover:opacity-90")
          }
        >
          {selected ? (
            <>
              <span className="material-symbols-outlined text-sm">check_circle</span>
              רעיון נבחר
            </>
          ) : (
            <>
              בחר ברעיון זה
              <span className="material-symbols-outlined text-sm">arrow_back</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function SelectIdeaStage() {
  const { session, setIdeas, selectIdea, setOutline, setDraftContent, setEditedContent, setAllDrafts, goToStage } = useSession();
  const { ideas, selectedIdea } = session;
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [replaceLoading, setReplaceLoading] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [validations, setValidations] = useState<IdeaValidation[] | null>(null);
  const [validationsLoading, setValidationsLoading] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const autoValidatedForRef = useRef<string>("");

  const handleValidateIdeas = async () => {
    if (!ideas.length) return;
    setValidationsLoading(true);
    setValidations(null);
    try {
      const res = await fetch("/api/validate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideas: ideas.map((i) => ({ title: i.title, description: i.description })),
        }),
      });
      const data = await res.json();
      if (data.results) setValidations(data.results);
    } finally {
      setValidationsLoading(false);
    }
  };

  useEffect(() => {
    if (ideas.length === 0) return;
    const key = ideas.map((i) => i.title).join("|");
    if (autoValidatedForRef.current === key) return;
    autoValidatedForRef.current = key;
    handleValidateIdeas();
  }, [ideas]);

  const handleReplaceIdeas = async () => {
    setReplaceLoading(true);
    setReplaceError(null);
    setValidations(null);
    selectIdea(null);
    try {
      const res = await fetch("/api/ideas", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "שגיאה ביצירת רעיונות");
      }
      const { ideas: newIdeas } = await res.json();
      setIdeas(newIdeas);
    } catch (e) {
      setReplaceError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setReplaceLoading(false);
    }
  };

  const handleSelectIdea = (idea: Idea) => {
    selectIdea(idea);
    setOutline(""); // שלד חדש ייטען לפי הרעיון הנבחר
    setDraftContent("");
    setEditedContent("");
    setAllDrafts(null);
    goToStage("writing");
  };

  const handleAddCustomIdea = (e: React.FormEvent) => {
    e.preventDefault();
    const title = customTitle.trim();
    if (!title) return;
    const newIdea: Idea = {
      id: randomId(),
      title,
      description: customDescription.trim(),
    };
    setIdeas([...ideas, newIdea]);
    selectIdea(newIdea);
    setOutline("");
    setDraftContent("");
    setEditedContent("");
    setAllDrafts(null);
    goToStage("writing");
    setCustomTitle("");
    setCustomDescription("");
    setShowCustomForm(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col px-4 py-8">
      {/* Breadcrumbs & Progress */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => goToStage("ideas")}
            className="text-sm font-medium leading-normal text-muted hover:underline"
          >
            שלב 1: יצירת רעיונות
          </button>
          <span className="text-sm font-medium leading-normal text-muted">/</span>
          <span className="text-sm font-bold leading-normal text-[var(--primary)]">
            שלב 2: בחירת רעיון
          </span>
        </div>
        <div className="flex min-w-[200px] flex-col gap-2">
          <div className="flex justify-between gap-4">
            <p className="text-xs font-medium text-foreground">התקדמות: 40%</p>
            <p className="text-xs text-muted">שלב 2 מתוך 5</p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-card">
            <div
              className="h-full rounded-full bg-[var(--primary)]"
              style={{ width: "40%" }}
            />
          </div>
        </div>
      </div>

      {/* Page Heading */}
      <div className="mb-8 flex flex-wrap justify-between gap-3">
        <div className="flex min-w-72 flex-col gap-2">
          <h1 className="text-3xl font-black leading-tight tracking-tight text-foreground md:text-4xl">
            בחרו את הרעיון המנצח
          </h1>
          <p className="max-w-2xl text-base font-normal leading-normal text-muted">
            הנה כמה כיוונים מעניינים שהבינה המלאכותית יצרה עבורכם. בחרו את האחד שהכי מתאים
            למטרות שלכם והמשיכו לכתיבת הטיוטה.
          </p>
        </div>
      </div>

      {/* Idea Cards Grid */}
      <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {ideas.map((idea, idx) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            selected={selectedIdea?.id === idea.id}
            onSelect={() => handleSelectIdea(idea)}
            validation={validations?.[idx]}
          />
        ))}
      </div>

      {ideas.length > 0 && validationsLoading && (
        <p className="mb-4 text-center text-sm text-muted">
          בודק נכונות מול הרשת…
        </p>
      )}

      {ideas.length > 0 && (
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleValidateIdeas}
              disabled={validationsLoading}
              className="text-sm font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
            >
              {validationsLoading ? "בודק…" : "בדוק שוב"}
            </button>
            <button
              type="button"
              onClick={handleReplaceIdeas}
              disabled={replaceLoading}
              className="text-sm font-medium text-muted hover:underline disabled:opacity-50"
            >
              {replaceLoading ? "מחליף רעיונות…" : "החלף ל־3 רעיונות אחרים"}
            </button>
          </div>
          {replaceError && (
            <p className="text-sm font-medium text-red-400" role="alert">
              {replaceError}
            </p>
          )}
        </div>
      )}

      {/* Footer Options */}
      <div className="flex flex-col gap-6 border-t border-border pt-8 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => goToStage("ideas")}
            className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-card"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            חזור ליצירת רעיונות
          </button>
          <button
            type="button"
            onClick={() => setShowCustomForm((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/10 px-5 py-2.5 text-sm font-bold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/20"
          >
            <span className="material-symbols-outlined text-lg">edit_note</span>
            הזן רעיון משלך
          </button>
        </div>
        <p className="text-xs italic text-muted">
          * ניתן לשנות את הבחירה גם בשלבים הבאים
        </p>
      </div>

      {/* Custom idea form (expandable) */}
      {showCustomForm && (
        <form
          onSubmit={handleAddCustomIdea}
          className="mt-6 flex flex-col gap-4 rounded-xl border-2 border-dashed border-border bg-card p-5"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
            הזן רעיון משלך
          </h2>
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="כותרת הרעיון"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-shadow"
            dir="rtl"
          />
          <textarea
            value={customDescription}
            onChange={(e) => setCustomDescription(e.target.value)}
            placeholder="תיאור (אופציונלי)"
            rows={2}
            className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-shadow"
            dir="rtl"
          />
          <button
            type="submit"
            disabled={!customTitle.trim()}
            className="self-end rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          >
            הוסף לרשימה ובחר
          </button>
        </form>
      )}

    </div>
  );
}
