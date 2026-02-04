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
    <div className="flex flex-col items-center">
      <div className="mb-12 max-w-[800px] w-full flex flex-col items-center">
        <span className="mb-4 inline-block rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
          שלב 1: התחלה
        </span>
        <h1 className="mb-4 text-center text-4xl font-bold leading-tight tracking-tight text-foreground lg:text-5xl">
          מה לכתוב?
        </h1>
        <p className="mx-auto max-w-2xl text-center text-lg font-normal leading-relaxed text-muted">
          בואו נתחיל בתהליך היצירה. תוכלו להיעזר בבינה המלאכותית שלנו כדי למצוא נושאים מרתקים
          וחדשניים, או להמשיך עם רעיון שכבר מגובש אצלכם.
        </p>
      </div>

      {error && (
        <p
          className="mb-4 rounded-lg border border-red-800 bg-red-950/30 px-4 py-2 text-sm font-medium text-red-400"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="mb-12 grid w-full max-w-[800px] grid-cols-1 gap-6 md:grid-cols-2">
        <div className="group relative flex cursor-pointer flex-col gap-6 overflow-hidden rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/5 p-8 transition-all hover:bg-[var(--primary)]/10">
          <div className="absolute -left-4 -top-4 size-24 rounded-full bg-[var(--primary)]/20 blur-3xl transition-all group-hover:bg-[var(--primary)]/40" />
          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex size-14 items-center justify-center rounded-lg bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/30">
              <span className="material-symbols-outlined text-3xl">psychology_alt</span>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-2xl font-bold text-foreground">צור רעיונות</h3>
                <span className="rounded border border-[var(--primary)]/20 bg-card px-2 py-0.5 text-[10px] font-bold text-[var(--primary)]">
                  AI POWERED
                </span>
              </div>
              <p className="text-base leading-relaxed text-muted">
                תן לבינה המלאכותית שלנו להציע לך נושאים, זוויות כתיבה חדשות ומגמות עכשוויות
                בתחום שלך.
              </p>
            </div>
          </div>
          <PrimaryButton
            onClick={handleCreateIdeas}
            disabled={loading}
            className="mt-4 w-full"
          >
            {loading ? "יוצר רעיונות…" : "תנו לי רעיונות"}
          </PrimaryButton>
        </div>

        <div className="group relative flex cursor-pointer flex-col gap-6 rounded-xl border border-border bg-card p-8 transition-all hover:bg-card-hover">
          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex size-14 items-center justify-center rounded-lg bg-background-subtle text-foreground transition-all group-hover:bg-[var(--primary)]/10">
              <span className="material-symbols-outlined text-3xl">edit_note</span>
            </div>
            <div>
              <h3 className="mb-2 text-2xl font-bold text-foreground">אשתמש ברעיון שלי</h3>
              <p className="text-base leading-relaxed text-muted">
                כבר יודעים על מה תרצו לכתוב? הזינו את הנושא שלכם ונתחיל לבנות את ראשי הפרקים
                יחד.
              </p>
            </div>
          </div>
          <PrimaryButton variant="secondary" onClick={handleUseMyOwn} className="mt-4 w-full">
            יש לי כבר נושא
          </PrimaryButton>
        </div>
      </div>

      <div className="w-full max-w-[800px]">
        <div className="h-1 w-full rounded-full bg-gradient-to-l from-transparent via-[var(--primary)]/20 to-transparent opacity-50" />
        <div className="mt-8 flex items-center gap-4 text-sm text-muted">
          <span className="material-symbols-outlined text-sm">verified_user</span>
          <span>התוכן נשמר אוטומטית כטיוטה</span>
        </div>
      </div>
    </div>
  );
}
