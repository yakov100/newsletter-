"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/state/session-context";
import type { DraftProvider } from "@/lib/ai/draft";
import type { OutlineValidationResult } from "@/lib/ai/validate-outline";

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
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("## ")) {
        const firstLineEnd = trimmed.indexOf("\n");
        const headingText = (firstLineEnd === -1 ? trimmed : trimmed.slice(0, firstLineEnd))
          .replace(/^##\s+/, "")
          .trim();
        const rest = firstLineEnd === -1 ? "" : trimmed.slice(firstLineEnd + 1).trim();
        const h2 = headingText ? `<h2>${escape(headingText)}</h2>` : "";
        return h2 + (rest ? `<p>${escape(rest)}</p>` : "");
      }
      return `<p>${escape(trimmed)}</p>`;
    })
    .filter((p) => p !== "")
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
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [reviseLoading, setReviseLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<OutlineValidationResult | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [outlineError, setOutlineError] = useState<string | null>(null);

  const useAllThree = selectedModel === "all" || selectedModel === "mini" || selectedModel === "cloud";

  const fetchOutline = useCallback(() => {
    if (!selectedIdea) return;
    setOutlineError(null);
    setOutlineLoading(true);
    fetch("/api/outline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: selectedIdea.title,
        description: selectedIdea.description,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setOutlineError(data.error || `שגיאה ${res.status}`);
          return;
        }
        if (data.outline && typeof data.outline === "string") {
          setOutline(data.outline);
        } else {
          setOutlineError("לא התקבל שלד מהשרת");
        }
      })
      .catch((err) => {
        setOutlineError(err instanceof Error ? err.message : "שגיאה בטעינת השלד");
      })
      .finally(() => setOutlineLoading(false));
  }, [selectedIdea, setOutline]);

  useEffect(() => {
    if (!selectedIdea || outline) return;
    fetchOutline();
  }, [selectedIdea, outline, fetchOutline]);

  async function generateDraft() {
    if (!selectedIdea || !outline?.trim()) return;
    setDraftError(null);
    setDraftLoading(true);
    setDraftLoadingLocal(true);
    setAllDrafts(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);
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
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      let data: { error?: string; draft?: string; drafts?: Record<string, string>; errors?: Record<string, string> };
      try {
        data = await res.json();
      } catch {
        setDraftError(res.ok ? "תגובת השרת לא בפורמט תקין" : `שגיאת שרת (${res.status})`);
        return;
      }
      if (!res.ok) {
        setDraftError(data.error ?? `שגיאה ${res.status}`);
        return;
      }
      if (data.error) {
        setDraftError(data.error);
        return;
      }
      if (generateAll && (data.drafts != null || data.errors != null)) {
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
          goToStage("editing");
        } else if (selectedModel === "cloud" && drafts.cloud) {
          setDraftContent(draftTextToHtml(drafts.cloud));
          setAllDrafts(null);
          goToStage("editing");
        } else if (Object.keys(draftsRecord).length > 0) {
          goToStage("editing");
        } else {
          setDraftError(Object.values(errorsRecord).filter(Boolean).join(" ") || "יצירת הטיוטות נכשלה");
        }
      } else if (data.draft != null && String(data.draft).trim()) {
        setDraftContent(draftTextToHtml(data.draft));
        goToStage("editing");
      } else {
        setDraftError("לא התקבלה טיוטה מהשרת");
      }
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof Error) {
        setDraftError(e.name === "AbortError" ? "הבקשה ארכה יותר מדי – נסה שוב" : e.message);
      } else {
        setDraftError("שגיאה ביצירת טיוטה");
      }
    } finally {
      setDraftLoading(false);
      setDraftLoadingLocal(false);
    }
  }

  async function runVerify() {
    if (!selectedIdea || !outline?.trim()) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const res = await fetch("/api/validate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedIdea.title,
          description: selectedIdea.description,
          outline,
        }),
      });
      let data: { error?: string; items?: unknown[]; summary?: string; allVerified?: boolean; usedWebSearch?: boolean };
      try {
        data = await res.json();
      } catch {
        setVerifyResult({
          items: [],
          summary: res.ok ? "תגובת השרת לא בפורמט תקין" : `שגיאת שרת (${res.status})`,
          allVerified: false,
          usedWebSearch: false,
        });
        return;
      }
      if (data.error) {
        setVerifyResult({
          items: [],
          summary: data.error,
          allVerified: false,
          usedWebSearch: false,
        });
        return;
      }
      setVerifyResult({
        items: data.items ?? [],
        summary: data.summary ?? "",
        allVerified: Boolean(data.allVerified),
        usedWebSearch: Boolean(data.usedWebSearch),
      });
    } catch (err) {
      setVerifyResult({
        items: [],
        summary: err instanceof Error ? err.message : "שגיאה באימות – נסה שוב",
        allVerified: false,
        usedWebSearch: false,
      });
    } finally {
      setVerifyLoading(false);
    }
  }

  async function runReviseOutline() {
    if (!outline?.trim() || !verifyResult || verifyResult.allVerified) return;
    setReviseLoading(true);
    try {
      const res = await fetch("/api/revise-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outline,
          items: verifyResult.items,
          summary: verifyResult.summary,
          allVerified: verifyResult.allVerified,
          usedWebSearch: verifyResult.usedWebSearch,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDraftError(data.error ?? "שגיאה בעדכון השלד");
        return;
      }
      if (data.revisedOutline != null && typeof data.revisedOutline === "string") {
        setOutline(data.revisedOutline);
        setVerifyResult(null);
      }
    } finally {
      setReviseLoading(false);
    }
  }

  if (!selectedIdea) return null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">שלד הכתבה</h1>
        <p className="text-muted">
          עבור על הסעיפים שנוצרו, ערוך אותם במידת הצורך ואשר את המבנה ליצירת הטיוטה.
        </p>
      </div>

      {draftError && (
        <div
          className="flex items-center gap-3 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 dark:border-red-700 dark:bg-red-950/50"
          role="alert"
        >
          <span className="material-symbols-outlined shrink-0 text-red-600 dark:text-red-400">error</span>
          <p className="flex-1 text-right text-sm font-medium text-red-800 dark:text-red-200" dir="rtl">
            {draftError}
          </p>
          <button
            type="button"
            onClick={() => setDraftError(null)}
            className="shrink-0 rounded-lg p-1 text-red-600 hover:bg-red-200/50 dark:text-red-400 dark:hover:bg-red-900/50"
            aria-label="סגור"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}

      {/* שלד + בחירת מודל בשורה אחת */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        {/* שלד הכתבה – מוצג במלואו בלי גלילה */}
        <div className="min-w-0 flex-1 rounded-xl border border-border bg-card shadow-sm">
          <div className="space-y-4 p-6">
            {/* כפתור אימות AI */}
            <div className="flex flex-col items-end gap-1">
              <p className="text-xs text-muted" dir="rtl">
                מומלץ לאמת לפני כתיבת הטיוטה כדי למנוע פרטים מומצאים.
              </p>
              <button
                type="button"
                onClick={runVerify}
                disabled={verifyLoading || !outline?.trim()}
                className="ai-verify-btn group relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-violet-500 via-fuchsia-500 to-cyan-400 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/30 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
              >
                <span className="relative flex size-5 items-center justify-center">
                  <span className="material-symbols-outlined text-lg">fact_check</span>
                  {verifyLoading && (
                    <span className="absolute inset-0 inline-block size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                </span>
                <span className="relative">
                  {verifyLoading ? "מאמת…" : "אימות AI"}
                </span>
                <span className="absolute -top-1 -right-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  AI
                </span>
              </button>
            </div>
            {/* כותרת המאמר */}
            <div className="group outline-item flex items-center gap-4 rounded-lg bg-background p-3 transition-all">
              <span className="material-symbols-outlined cursor-move text-muted opacity-0 group-hover:opacity-100">
                drag_indicator
              </span>
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-bold text-[var(--primary)]">כותרת המאמר</span>
                <input
                  readOnly
                  className="w-full border-none bg-transparent p-0 text-xl font-bold text-foreground focus:ring-0"
                  value={selectedIdea.title}
                />
              </div>
            </div>

            {/* שלד (תוכן עריכה) – גובה אוטומטי, מוצג במלואו */}
            {outlineLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
                טוען שלד…
              </p>
            ) : outlineError ? (
              <div className="flex flex-col gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4" role="alert">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200" dir="rtl">
                  {outlineError}
                </p>
                <button
                  type="button"
                  onClick={fetchOutline}
                  className="self-end flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
                >
                  <span className="material-symbols-outlined text-lg">refresh</span>
                  נסה שוב
                </button>
              </div>
            ) : outline ? (
              <div className="outline-item flex items-start gap-4 rounded-lg border border-border p-4 transition-all hover:border-[var(--primary)]/30">
                <span className="material-symbols-outlined mt-1 cursor-move text-muted shrink-0">
                  drag_handle
                </span>
                <div className="min-w-0 flex-1">
                  <textarea
                    value={outline}
                    onChange={(e) => {
                      setOutline(e.target.value);
                      setVerifyResult(null);
                    }}
                    rows={Math.max(8, outline.split(/\n/).length + 2)}
                    className="min-h-0 w-full resize-none overflow-visible border-none bg-transparent p-0 text-sm leading-relaxed text-foreground placeholder:text-muted focus:ring-0"
                    placeholder="שלד הכתבה…"
                    dir="rtl"
                  />
                </div>
              </div>
            ) : null}

            {/* תוצאות אימות AI */}
            {verifyResult && (
              <div
                className="rounded-xl border-2 border-violet-200 bg-gradient-to-b from-violet-50/80 to-fuchsia-50/50 p-4 shadow-inner dark:border-violet-800 dark:from-violet-950/30 dark:to-fuchsia-950/20"
                role="region"
                aria-label="תוצאות אימות"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="material-symbols-outlined text-violet-600 dark:text-violet-400">verified</span>
                  <span className="text-sm font-bold text-foreground">תוצאות אימות הנתונים</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      verifyResult.allVerified
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                    }`}
                  >
                    {verifyResult.allVerified ? "הכל מאומת" : "יש לבדוק"}
                  </span>
                  {"usedWebSearch" in verifyResult && verifyResult.usedWebSearch && (
                    <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800 dark:bg-violet-900/50 dark:text-violet-300">
                      אומת מול חיפוש ברשת
                    </span>
                  )}
                </div>
                {verifyResult.summary && (
                  <p className="mb-3 text-sm leading-relaxed text-foreground" dir="rtl">
                    {verifyResult.summary}
                  </p>
                )}
                {verifyResult.items.length > 0 && (
                  <ul className="space-y-2">
                    {verifyResult.items.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 rounded-lg border border-border/80 bg-card/80 p-2.5 text-right"
                      >
                        <span
                          className={`mt-0.5 shrink-0 rounded-full p-0.5 ${
                            item.status === "ok"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : item.status === "warning"
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-slate-500 dark:text-slate-400"
                          }`}
                          aria-hidden
                        >
                          {item.status === "ok" ? (
                            <span className="material-symbols-outlined text-lg">check_circle</span>
                          ) : item.status === "warning" ? (
                            <span className="material-symbols-outlined text-lg">warning</span>
                          ) : (
                            <span className="material-symbols-outlined text-lg">help</span>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground" dir="rtl">
                            {item.text}
                          </p>
                          {item.reason && (
                            <p className="mt-1 text-xs text-muted" dir="rtl">
                              {item.reason}
                            </p>
                          )}
                          {item.sources && item.sources.length > 0 && (
                            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                              {item.sources.map((src, j) => (
                                <li key={j}>
                                  <a
                                    href={src.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-violet-600 underline hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300"
                                  >
                                    {src.title || "מקור"}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {!verifyResult.allVerified && verifyResult.items.some((i) => i.status === "warning" || i.status === "unsure") && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={runReviseOutline}
                      disabled={reviseLoading}
                      className="inline-flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-800 transition-colors hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-200 dark:hover:bg-amber-500/20"
                    >
                      {reviseLoading ? (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <span className="material-symbols-outlined text-lg">edit_note</span>
                      )}
                      {reviseLoading ? "מתקן…" : "תקן שלד לפי האימות"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* כפתורי בחירת מודל – מאונכים בצד השלד */}
        <div className="model-panel flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-lg backdrop-blur-sm lg:w-56 lg:shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-1 w-1 rounded-full bg-[var(--primary)] shadow-[0_0_8px_var(--primary)]" aria-hidden />
              <h3 className="text-lg font-bold tracking-tight text-foreground">בחר מודל</h3>
            </div>
            <p className="text-xs leading-relaxed text-muted">
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
                      ? "border-[var(--primary)]/60 bg-[var(--primary)]/10 shadow-[0_0_20px_rgba(99,102,241,0.2)] ring-1 ring-[var(--primary)]/30"
                      : "border-border bg-background group-hover:border-[var(--border-strong)] group-hover:bg-card-hover group-active:scale-[0.99]")
                  }
                >
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl ${opt.iconBg} ${opt.iconColor} shadow-inner transition-transform group-hover:scale-105 ${selectedModel === opt.value ? "ring-1 ring-border" : ""}`}
                  >
                    {opt.useLogo && opt.value === "mini" ? (
                      <GeminiLogo className="size-5 text-blue-500" />
                    ) : (
                      <span className="material-symbols-outlined text-lg">{opt.icon}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden text-right">
                    <p className="truncate text-sm font-semibold text-foreground">{opt.label}</p>
                    <p className="truncate text-[11px] text-muted">{opt.sublabel}</p>
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
            <p className="text-center text-[11px] text-muted">
              משך משוער כ־30 שניות
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
