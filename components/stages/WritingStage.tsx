"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/state/session-context";
import type { DraftProvider } from "@/lib/ai/draft";

function draftTextToHtml(text: string): string {
  if (!text.trim()) return "";
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return text
    .split(/\n\n+/)
    .map((p) => `<p>${escape(p.trim())}</p>`)
    .filter((p) => p !== "<p></p>")
    .join("");
}

type ModelChoice = "openai" | "mini" | "cloud" | "all";

/** סמליל Gemini – כוכב ניצוץ בסגנון הלוגו הרשמי */
function GeminiLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 22l-2.5-6.5L3 11l6.5-2.5L12 2z"
        fill="currentColor"
      />
    </svg>
  );
}

const MODEL_OPTIONS: {
  value: ModelChoice;
  label: string;
  sublabel: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  useLogo?: boolean;
}[] = [
  {
    value: "openai",
    label: "OpenAI",
    sublabel: "GPT-4o (הכי מדויק)",
    icon: "bolt",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
  },
  {
    value: "mini",
    label: "Gemini",
    sublabel: "יעיל ומהיר מאוד",
    icon: "",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
    useLogo: true,
  },
  {
    value: "cloud",
    label: "Claude",
    sublabel: "סגנון כתיבה אנושי",
    icon: "auto_fix",
    iconBg: "bg-orange-500/10",
    iconColor: "text-orange-500",
  },
  {
    value: "all",
    label: "All (הכל)",
    sublabel: "יצירת 3 גרסאות",
    icon: "group_work",
    iconBg: "bg-[var(--primary)]/10",
    iconColor: "text-[var(--primary)]",
  },
];

export function WritingStage() {
  const { session, setDraftContent, setOutline, setDraftLoading, setAllDrafts, goToStage } = useSession();
  const { selectedIdea, outline } = session;
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [draftLoading, setDraftLoadingLocal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelChoice>("openai");

  const useAllThree = selectedModel === "all" || selectedModel === "mini" || selectedModel === "cloud";

  useEffect(() => {
    if (!selectedIdea || outline) return;
    let cancelled = false;
    setOutlineLoading(true);
    fetch("/api/outline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: selectedIdea.title,
        description: selectedIdea.description,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.outline) setOutline(data.outline);
      })
      .finally(() => setOutlineLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selectedIdea, outline, setOutline]);

  async function generateDraft() {
    if (!selectedIdea || !outline?.trim()) return;
    setDraftLoading(true);
    setDraftLoadingLocal(true);
    setAllDrafts(null);
    goToStage("editing");
    try {
      const generateAll = useAllThree;
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedIdea.title,
          description: selectedIdea.description,
          outline,
          generateAll,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setAllDrafts({ drafts: {}, errors: { openai: data.error } });
        return;
      }
      if (generateAll && (data.drafts || data.errors)) {
        const drafts = data.drafts ?? {};
        const errors = data.errors ?? {};
        const draftsRecord: Record<string, string> = {};
        const errorsRecord: Record<string, string> = {};
        for (const k of Object.keys(drafts)) {
          if (drafts[k as DraftProvider]) draftsRecord[k] = drafts[k as DraftProvider];
        }
        for (const k of Object.keys(errors)) {
          if (errors[k as DraftProvider]) errorsRecord[k] = errors[k as DraftProvider];
        }
        setAllDrafts({ drafts: draftsRecord, errors: errorsRecord });
        if (selectedModel === "mini" && drafts.mini) {
          setDraftContent(draftTextToHtml(drafts.mini));
          setAllDrafts(null);
        } else if (selectedModel === "cloud" && drafts.cloud) {
          setDraftContent(draftTextToHtml(drafts.cloud));
          setAllDrafts(null);
        }
      } else if (data.draft) {
        setDraftContent(draftTextToHtml(data.draft));
      }
    } finally {
      setDraftLoading(false);
      setDraftLoadingLocal(false);
    }
  }

  if (!selectedIdea) return null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">שלד הכתבה</h1>
        <p className="text-white/60">
          עבור על הסעיפים שנוצרו, ערוך אותם במידת הצורך ואשר את המבנה ליצירת הטיוטה.
        </p>
      </div>

      {/* שלד + בחירת מודל בשורה אחת */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        {/* שלד הכתבה – מוצג במלואו בלי גלילה */}
        <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#101622] shadow-sm">
          <div className="space-y-4 p-6">
            {/* כותרת המאמר */}
            <div className="group outline-item flex items-center gap-4 rounded-lg bg-white/5 p-3 transition-all">
              <span className="material-symbols-outlined cursor-move text-white/40 opacity-0 group-hover:opacity-100">
                drag_indicator
              </span>
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-bold text-[var(--primary)]">כותרת המאמר</span>
                <input
                  readOnly
                  className="w-full border-none bg-transparent p-0 text-xl font-bold text-white focus:ring-0"
                  value={selectedIdea.title}
                />
              </div>
            </div>

            {/* שלד (תוכן עריכה) – גובה אוטומטי, מוצג במלואו */}
            {outlineLoading ? (
              <p className="flex items-center gap-2 text-sm text-white/60">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
                טוען שלד…
              </p>
            ) : outline ? (
              <div className="outline-item flex items-start gap-4 rounded-lg border border-white/10 p-4 transition-all hover:border-[var(--primary)]/30">
                <span className="material-symbols-outlined mt-1 cursor-move text-white/40 shrink-0">
                  drag_handle
                </span>
                <div className="min-w-0 flex-1">
                  <textarea
                    value={outline}
                    onChange={(e) => setOutline(e.target.value)}
                    rows={Math.max(8, outline.split(/\n/).length + 2)}
                    className="min-h-0 w-full resize-none overflow-visible border-none bg-transparent p-0 text-sm leading-relaxed text-white placeholder:text-white/40 focus:ring-0"
                    placeholder="שלד הכתבה…"
                    dir="rtl"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* כפתורי בחירת מודל – מאונכים בצד השלד */}
        <div className="model-panel flex flex-col gap-5 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-transparent p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-sm lg:w-56 lg:shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-1 w-1 rounded-full bg-[var(--primary)] shadow-[0_0_8px_var(--primary)]" aria-hidden />
              <h3 className="text-lg font-bold tracking-tight text-white">בחר מודל</h3>
            </div>
            <p className="text-xs leading-relaxed text-white/50">
              הטיוטה תיווצר על בסיס הסעיפים שאושרו
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            {MODEL_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="model-card relative cursor-pointer group"
              >
                <input
                  type="radio"
                  name="ai_model"
                  checked={selectedModel === opt.value}
                  onChange={() => setSelectedModel(opt.value)}
                  className="hidden"
                />
                <div
                  className={
                    "flex items-center gap-3.5 rounded-xl border p-3.5 transition-all duration-200 " +
                    (selectedModel === opt.value
                      ? "border-[var(--primary)]/60 bg-[var(--primary)]/10 shadow-[0_0_20px_rgba(19,91,236,0.2)] ring-1 ring-[var(--primary)]/30"
                      : "border-white/[0.06] bg-white/[0.02] group-hover:border-white/15 group-hover:bg-white/[0.05] group-active:scale-[0.99]")
                  }
                >
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl ${opt.iconBg} ${opt.iconColor} shadow-inner transition-transform group-hover:scale-105 ${selectedModel === opt.value ? "ring-1 ring-white/10" : ""}`}
                  >
                    {opt.useLogo && opt.value === "mini" ? (
                      <GeminiLogo className="size-5 text-blue-500" />
                    ) : (
                      <span className="material-symbols-outlined text-lg">{opt.icon}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden text-right">
                    <p className="truncate text-sm font-semibold text-white">{opt.label}</p>
                    <p className="truncate text-[11px] text-white/45">{opt.sublabel}</p>
                  </div>
                  {selectedModel === opt.value && (
                    <span className="material-symbols-outlined shrink-0 text-base text-[var(--primary)]">check_circle</span>
                  )}
                </div>
              </label>
            ))}
          </div>
          <div className="mt-1 space-y-2">
            <button
              type="button"
              onClick={generateDraft}
              disabled={draftLoading || !outline?.trim()}
              className="create-draft-btn flex w-full items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:shadow-[var(--primary)]/25 disabled:opacity-50 disabled:pointer-events-none"
            >
              {draftLoading ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  כותב…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">auto_awesome</span>
                  צור טיוטה
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-white/40">
              משך משוער כ־30 שניות
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
