"use client";

import { useState } from "react";
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
  return (
    <div
      className={
        "flex flex-col overflow-hidden rounded-xl transition-all " +
        (selected
          ? "border-2 border-[var(--primary)] bg-[#1a2333] shadow-lg shadow-[var(--primary)]/10"
          : "border border-white/10 bg-[#1a2333] hover:border-[var(--primary)]/50")
      }
    >
      <div className="flex flex-1 flex-col gap-3 p-5 text-right">
        <h3 className="text-lg font-bold leading-snug text-white">{idea.title}</h3>
        <p className="flex-1 text-sm font-normal leading-relaxed text-white/60">
          {idea.description}
        </p>
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
  const { session, setIdeas, selectIdea, goToStage } = useSession();
  const { ideas, selectedIdea } = session;
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [replaceLoading, setReplaceLoading] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [validations, setValidations] = useState<IdeaValidation[] | null>(null);
  const [validationsLoading, setValidationsLoading] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);

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
            className="text-sm font-medium leading-normal text-white/60 hover:underline"
          >
            שלב 1: יצירת רעיונות
          </button>
          <span className="text-sm font-medium leading-normal text-white/50">/</span>
          <span className="text-sm font-bold leading-normal text-[var(--primary)]">
            שלב 2: בחירת רעיון
          </span>
        </div>
        <div className="flex min-w-[200px] flex-col gap-2">
          <div className="flex justify-between gap-4">
            <p className="text-xs font-medium text-white/80">התקדמות: 40%</p>
            <p className="text-xs text-white/50">שלב 2 מתוך 5</p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
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
          <h1 className="text-3xl font-black leading-tight tracking-tight text-white md:text-4xl">
            בחרו את הרעיון המנצח
          </h1>
          <p className="max-w-2xl text-base font-normal leading-normal text-white/60">
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

      {ideas.length > 0 && (
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleValidateIdeas}
              disabled={validationsLoading}
              className="text-sm font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
            >
              {validationsLoading ? "בודק…" : "AI יבדוק אם ההצעות נכונות"}
            </button>
            <button
              type="button"
              onClick={handleReplaceIdeas}
              disabled={replaceLoading}
              className="text-sm font-medium text-white/60 hover:underline disabled:opacity-50"
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
      <div className="flex flex-col gap-6 border-t border-white/10 pt-8 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => goToStage("ideas")}
            className="flex items-center gap-2 rounded-lg border border-white/20 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10"
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
        <p className="text-xs italic text-white/50">
          * ניתן לשנות את הבחירה גם בשלבים הבאים
        </p>
      </div>

      {/* Custom idea form (expandable) */}
      {showCustomForm && (
        <form
          onSubmit={handleAddCustomIdea}
          className="mt-6 flex flex-col gap-4 rounded-xl border-2 border-dashed border-white/10 bg-white/5 p-5"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
            הזן רעיון משלך
          </h2>
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="כותרת הרעיון"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-shadow"
            dir="rtl"
          />
          <textarea
            value={customDescription}
            onChange={(e) => setCustomDescription(e.target.value)}
            placeholder="תיאור (אופציונלי)"
            rows={2}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-shadow"
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
