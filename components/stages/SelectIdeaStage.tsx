"use client";

import { useState } from "react";
import { useSession } from "@/lib/state/session-context";
import type { Idea } from "@/types/idea";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

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
    <button
      type="button"
      onClick={onSelect}
      className={
        "w-full text-right rounded-2xl border-2 p-5 transition-all duration-200 hover-lift " +
        (selected
          ? "border-[var(--accent)] bg-[var(--accent-light)]/50 dark:bg-[var(--accent-dark)]/20 shadow-md"
          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)] dark:border-[var(--border)] dark:bg-[var(--card)] dark:hover:border-[var(--border-strong)]")
      }
    >
      <h3 className="font-semibold text-[var(--foreground)] mb-1.5 text-lg">
        {idea.title}
      </h3>
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        {idea.description}
      </p>
      {validation !== undefined && (
        <p
          className={`mt-2 text-xs font-medium ${
            validation.valid
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {validation.valid
            ? "✓ נכון, רלוונטי"
            : `לא רלוונטי${validation.reason ? `: ${validation.reason}` : ""}`}
        </p>
      )}
    </button>
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

  const handleContinue = () => {
    if (selectedIdea) goToStage("writing");
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
    setCustomTitle("");
    setCustomDescription("");
  };

  return (
    <div className="flex flex-col gap-8 py-12 max-w-xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          בחר רעיון אחד
        </h1>
        <p className="text-[var(--foreground-muted)]">
          לחץ על הרעיון שבו תרצה להמשיך. רק אחד – כדי שלא להתפזר.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {ideas.map((idea, idx) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            selected={selectedIdea?.id === idea.id}
            onSelect={() => selectIdea(idea)}
            validation={validations?.[idx]}
          />
        ))}
      </div>

      {ideas.length > 0 && (
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleValidateIdeas}
            disabled={validationsLoading}
            className="text-sm font-medium text-[var(--accent)] hover:underline disabled:opacity-50"
          >
            {validationsLoading ? "בודק…" : "AI יבדוק אם ההצעות נכונות"}
          </button>
          {replaceError && (
            <p className="text-red-600 dark:text-red-400 text-sm font-medium" role="alert">
              {replaceError}
            </p>
          )}
          <PrimaryButton
            variant="secondary"
            onClick={handleReplaceIdeas}
            disabled={replaceLoading}
            suppressHydrationWarning
          >
            {replaceLoading ? "מחליף רעיונות…" : "החלף ל־3 רעיונות אחרים"}
          </PrimaryButton>
        </div>
      )}

      <form
        onSubmit={handleAddCustomIdea}
        className="flex flex-col gap-4 rounded-2xl border-2 border-dashed border-[var(--border)] p-5 bg-[var(--background-subtle)]/80 dark:bg-[var(--card)]/50"
      >
        <h2 className="text-sm font-semibold text-[var(--foreground-muted)] uppercase tracking-wide">
          או הוסף רעיון משלך
        </h2>
        <input
          type="text"
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          placeholder="כותרת הרעיון"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-shadow"
          dir="rtl"
        />
        <textarea
          value={customDescription}
          onChange={(e) => setCustomDescription(e.target.value)}
          placeholder="תיאור (אופציונלי)"
          rows={2}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-none transition-shadow"
          dir="rtl"
        />
        <button
          type="submit"
          disabled={!customTitle.trim()}
          className="self-end px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          הוסף לרשימה ובחר
        </button>
      </form>

      <PrimaryButton
        onClick={handleContinue}
        disabled={!selectedIdea}
        className="self-center min-w-[160px]"
      >
        ממש לכתיבה
      </PrimaryButton>
    </div>
  );
}
