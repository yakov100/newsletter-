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
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 py-12">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        מה לכתוב?
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400 max-w-md text-center">
        צור רשימת רעיונות לכתבה. אחר כך תבחר אחד ותמשיך לכתיבה.
      </p>
      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm" role="alert">
          {error}
        </p>
      )}
      <PrimaryButton onClick={handleCreateIdeas} disabled={loading}>
        {loading ? "יוצר רעיונות…" : "צור רעיונות"}
      </PrimaryButton>
    </div>
  );
}
