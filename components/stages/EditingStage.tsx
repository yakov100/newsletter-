"use client";

import { useState } from "react";
import { useSession } from "@/lib/state/session-context";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { RichEditor } from "@/components/editor/RichEditor";

interface SuggestionValidation {
  suggestion: string;
  valid: boolean;
  reason?: string;
}

export function EditingStage() {
  const { session, setEditedContent, goToStage } = useSession();
  const { draftContent, editedContent } = session;
  const content = editedContent || draftContent;
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [validations, setValidations] = useState<SuggestionValidation[] | null>(null);
  const [validationsLoading, setValidationsLoading] = useState(false);

  const handleSuggestions = async () => {
    setSuggestionsLoading(true);
    setSuggestions([]);
    setValidations(null);
    try {
      const res = await fetch("/api/edit-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftHtml: content }),
      });
      const data = await res.json();
      if (data.suggestions) setSuggestions(data.suggestions);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleValidateSuggestions = async () => {
    if (!suggestions.length) return;
    setValidationsLoading(true);
    setValidations(null);
    try {
      const res = await fetch("/api/validate-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftHtml: content, suggestions }),
      });
      const data = await res.json();
      if (data.results) setValidations(data.results);
    } finally {
      setValidationsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 py-12 max-w-2xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          עריכה וליטוש
        </h1>
        <p className="text-[var(--foreground-muted)]">
          חידוד ניסוחים, קיצור או הארכה, שיפור בהירות. בלי ליצור תוכן חדש.
        </p>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <button
            type="button"
            onClick={handleSuggestions}
            disabled={suggestionsLoading}
            className="text-sm font-medium text-[var(--accent)] hover:underline disabled:opacity-50"
          >
            {suggestionsLoading ? "טוען…" : "הצעות לשיפור"}
          </button>
          <button
            type="button"
            onClick={handleValidateSuggestions}
            disabled={suggestions.length === 0 || validationsLoading}
            title={suggestions.length === 0 ? "לחץ קודם על «הצעות לשיפור»" : undefined}
            className="text-sm font-medium text-[var(--accent)] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {validationsLoading ? "בודק…" : "AI יבדוק אם ההצעות נכונות"}
          </button>
        </div>
        {suggestions.length > 0 && (
          <ul className="list-disc list-inside text-sm text-[var(--foreground-muted)] mb-4 space-y-1.5 rounded-xl bg-[var(--background-subtle)]/80 p-4">
            {suggestions.map((s, idx) => {
              const validation = validations?.[idx];
              return (
                <li key={idx} className="flex flex-col gap-0.5">
                  <span>{s}</span>
                  {validation !== undefined && (
                    <span
                      className={`text-xs font-medium ${
                        validation.valid
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {validation.valid ? "✓ נכון, רלוונטי" : `לא רלוונטי${validation.reason ? `: ${validation.reason}` : ""}`}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div>
        <label className="block text-sm font-semibold text-[var(--foreground-muted)] mb-2">
          הכתבה
        </label>
        <RichEditor
          value={content}
          onChange={setEditedContent}
          placeholder="ערוך כאן…"
        />
      </div>
      <PrimaryButton onClick={() => goToStage("completion")} className="self-end">
        הכתבה מוכנה
      </PrimaryButton>
    </div>
  );
}
