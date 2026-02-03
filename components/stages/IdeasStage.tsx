"use client";

import { useState } from "react";
import { useSession } from "@/lib/state/session-context";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export function IdeasStage() {
  const { setIdeas, goToStage } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateIdeas = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ideas", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "שגיאה ביצירת רעיונות");
      }
      const { ideas } = await res.json();
      setIdeas(ideas);
      goToStage("select");
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  };

  const handleUseMyOwn = () => {
    setIdeas([]);
    goToStage("select");
  };

  return (
    <div className="flex flex-col items-center gap-10 py-12 sm:py-16">
      <div className="text-center space-y-4 max-w-lg">
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--foreground)] tracking-tight">
          מה לכתוב?
        </h1>
        <p className="text-[var(--foreground-muted)] text-lg leading-relaxed" suppressHydrationWarning>
          צור רשימת רעיונות לכתבה. אחר כך תבחר אחד ותמשיך לכתיבה.
        </p>
      </div>
      {error && (
        <p
          className="text-red-600 dark:text-red-400 text-sm font-medium px-4 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
          role="alert"
        >
          {error}
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
        <PrimaryButton
          onClick={handleCreateIdeas}
          disabled={loading}
          suppressHydrationWarning
          className="min-w-[180px]"
        >
          {loading ? "יוצר רעיונות…" : "צור רעיונות"}
        </PrimaryButton>
        <PrimaryButton variant="secondary" onClick={handleUseMyOwn}>
          יש לי רעיון משלך
        </PrimaryButton>
      </div>
    </div>
  );
}
