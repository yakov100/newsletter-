"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/state/session-context";
import type { OutlineValidationResult } from "@/lib/ai/validate-outline";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { RichEditor, type RichEditorHandle, type DraftTheme, DEFAULT_DRAFT_THEME } from "@/components/editor/RichEditor";

const DRAFT_THEME_STORAGE_KEY = "newsletter-draft-theme";

function loadDraftTheme(): DraftTheme {
  if (typeof window === "undefined") return DEFAULT_DRAFT_THEME;
  try {
    const raw = localStorage.getItem(DRAFT_THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_DRAFT_THEME;
    const parsed = JSON.parse(raw) as DraftTheme;
    if (parsed?.backgroundColor && parsed?.textColor) return parsed;
  } catch {
    /* ignore */
  }
  return DEFAULT_DRAFT_THEME;
}

const MAX_HISTORY = 30;
const HISTORY_DEBOUNCE_MS = 12000;

interface HistoryEntry {
  html: string;
  at: number;
}

interface SuggestionValidation {
  suggestion: string;
  valid: boolean;
  reason?: string;
}

interface SourceReference {
  title: string;
  url: string;
  description?: string;
}

const QUICK_ACTIONS = [
  { key: "expand", icon: "expand", label: "הרחב פסקה נבחרת" },
  { key: "sources", icon: "auto_stories", label: "הוסף מקורות וסימוכין" },
] as const;

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

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  mini: "Gemini",
  cloud: "Cloud (Anthropic / Claude)",
};

export function EditingStage() {
  const { session, setDraftContent, setEditedContent, setAllDrafts, goToStage } = useSession();
  const { selectedIdea, draftContent, editedContent, draftLoading, allDrafts } = session;
  const content = editedContent || draftContent;
  const hasDraftsToChoose = allDrafts && Object.keys(allDrafts.drafts).length > 0 && !content;
  const showDraftLoading = draftLoading && !content && !hasDraftsToChoose;
  const editorRef = useRef<RichEditorHandle>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [validations, setValidations] = useState<SuggestionValidation[] | null>(null);
  const [validationsLoading, setValidationsLoading] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");
  const [customSendLoading, setCustomSendLoading] = useState(false);
  const [expandLoading, setExpandLoading] = useState(false);
  const [sourcesResult, setSourcesResult] = useState<SourceReference[] | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [contentHistory, setContentHistory] = useState<HistoryEntry[]>([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [draftTheme, setDraftTheme] = useState<DraftTheme>(DEFAULT_DRAFT_THEME);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<OutlineValidationResult | null>(null);
  const lastContentRef = useRef<string>("");
  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraftTheme(loadDraftTheme());
  }, []);

  const handleDraftThemeChange = useCallback((theme: DraftTheme) => {
    setDraftTheme(theme);
    try {
      localStorage.setItem(DRAFT_THEME_STORAGE_KEY, JSON.stringify(theme));
    } catch {
      /* ignore */
    }
  }, []);

  const pushToHistory = useCallback((html: string) => {
    const trimmed = html.trim();
    if (!trimmed) return;
    setContentHistory((prev) => {
      const next = [{ html: trimmed, at: Date.now() }, ...prev];
      return next.slice(0, MAX_HISTORY);
    });
  }, []);

  useEffect(() => {
    if (!content) return;
    lastContentRef.current = content;
    if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current = setTimeout(() => {
      historyDebounceRef.current = null;
      const toPush = lastContentRef.current?.trim();
      if (toPush) {
        setContentHistory((prev) => {
          const last = prev[0]?.html;
          if (last === toPush) return prev;
          return [{ html: toPush, at: Date.now() }, ...prev].slice(0, MAX_HISTORY);
        });
      }
    }, HISTORY_DEBOUNCE_MS);
    return () => {
      if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    };
  }, [content]);

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

  const handleCustomSend = async () => {
    const instr = customInstruction.trim();
    if (!instr) return;
    setCustomSendLoading(true);
    try {
      const res = await fetch("/api/apply-instruction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftHtml: content, instruction: instr }),
      });
      const data = await res.json();
      if (data.html != null) {
        pushToHistory(content);
        setEditedContent(data.html);
        setCustomInstruction("");
      } else if (data.error) {
        setToast(data.error);
      }
    } finally {
      setCustomSendLoading(false);
    }
  };

  const handleExpandParagraph = async () => {
    const selected = editorRef.current?.getSelectedText()?.trim();
    if (!selected) {
      setToast("בחר פסקה או משפט להרחבה");
      return;
    }
    setExpandLoading(true);
    try {
      const res = await fetch("/api/expand-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selected }),
      });
      const data = await res.json();
      if (data.expandedText) {
        editorRef.current?.replaceSelection(`<p>${data.expandedText.replace(/\n/g, "</p><p>")}</p>`);
      } else if (data.error) {
        setToast(data.error);
      }
    } finally {
      setExpandLoading(false);
    }
  };

  const handleSources = async () => {
    const text = content.replace(/<[^>]+>/g, " ").trim();
    if (!text) {
      setToast("אין תוכן ליצירת מקורות");
      return;
    }
    setSourcesLoading(true);
    setSourcesResult(null);
    try {
      const res = await fetch("/api/sources-references", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftHtml: content }),
      });
      const data = await res.json();
      if (data.sources?.length) {
        setSourcesResult(data.sources);
      } else if (data.error) {
        setToast(data.error);
      } else {
        setToast("לא נמצאו מקורות להצגה");
      }
    } finally {
      setSourcesLoading(false);
    }
  };

  const handleAddSourcesToDocument = () => {
    if (!sourcesResult?.length) return;
    pushToHistory(content);
    const listItems = sourcesResult
      .map(
        (s) =>
          `<li><a href="${s.url.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer">${s.title.replace(/</g, "&lt;")}</a>${s.description ? ` – ${s.description.replace(/</g, "&lt;")}` : ""}</li>`
      )
      .join("");
    const section = `<h2>מקורות וסימוכין</h2><ul>${listItems}</ul>`;
    const separator = content.trim().endsWith("</p>") ? "" : "<p></p>";
    setEditedContent((content || "").trim() + separator + section);
    setSourcesResult(null);
    setToast("המקורות נוספו לסוף המאמר");
  };

  const runVerify = async () => {
    if (!selectedIdea || !content?.trim()) {
      setToast("אין תוכן לאימות");
      return;
    }
    const plainText = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!plainText) {
      setToast("אין תוכן לאימות");
      return;
    }
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const res = await fetch("/api/validate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedIdea.title,
          description: selectedIdea.description ?? "",
          draft: plainText,
        }),
      });
      let data: { error?: string } & Partial<OutlineValidationResult>;
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
  };

  const showComingSoon = () => setToast("בקרוב");

  const handleRestoreHistory = (entry: HistoryEntry) => {
    setEditedContent(entry.html);
    setShowHistoryPanel(false);
  };

  const firstSuggestion = suggestions[0];

  // טוסט – ניקוי אוטומטי
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {toast && (
        <div
          role="alert"
          className="fixed bottom-6 start-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground shadow-xl"
        >
          {toast}
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* אזור העורך */}
        <div className="flex flex-1 flex-col overflow-y-auto p-6">
          <div className="mx-auto w-full max-w-4xl">
            {showDraftLoading && (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-6 rounded-2xl border border-border bg-card p-12 shadow-inner">
                <span className="inline-block h-12 w-12 animate-spin rounded-full border-3 border-[var(--primary)] border-t-transparent" />
                <p className="text-xl font-semibold text-foreground">הטיוטה נוצרת</p>
                <p className="text-sm text-muted">זה יכול לקחת עד דקה – אנא המתין</p>
              </div>
            )}
            {hasDraftsToChoose && allDrafts && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">בחר איזו טיוטה עדיפה</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(allDrafts.drafts).map(([provider, draft]) => {
                    const error = allDrafts.errors[provider];
                    const label = PROVIDER_LABELS[provider] ?? provider;
                    if (error && !draft) {
                      return (
                        <div
                          key={provider}
                          className="rounded-xl border border-red-800 bg-red-950/30 p-4"
                        >
                          <p className="font-medium text-foreground">{label}</p>
                          <p className="mt-1 text-sm text-red-400">{error}</p>
                        </div>
                      );
                    }
                    if (!draft) return null;
                    return (
                      <div
                        key={provider}
                        className="flex min-h-0 min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4"
                      >
                        <div className="flex shrink-0 items-center justify-between gap-2">
                          <p className="font-medium text-foreground">{label}</p>
                          <PrimaryButton
                            onClick={() => {
                              setDraftContent(draftTextToHtml(draft));
                              setAllDrafts(null);
                            }}
                            className="px-3 py-1.5 text-sm"
                          >
                            בחר טיוטה זו
                          </PrimaryButton>
                        </div>
                        <div
                          className="min-h-[200px] max-h-[70vh] flex-1 overflow-y-auto whitespace-pre-wrap border-t border-border pt-3 text-sm leading-relaxed text-muted"
                          dir="rtl"
                        >
                          {draft}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {!showDraftLoading && !hasDraftsToChoose && (
              <>
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                  <RichEditor
                    ref={editorRef}
                    value={content}
                    onChange={(html) => {
                      setEditedContent(html);
                      setVerifyResult(null);
                    }}
                    placeholder="ערוך כאן…"
                    onImproveText={handleSuggestions}
                    draftTheme={draftTheme}
                    onDraftThemeChange={handleDraftThemeChange}
                  />
                </div>
                {/* אימות AI על טקסט הטיוטה */}
                <div className="mt-4 flex flex-col gap-3">
                  <p className="text-xs text-muted" dir="rtl">
                    מומלץ לאמת עובדות בטקסט לפני סיום.
                  </p>
                  <button
                    type="button"
                    onClick={runVerify}
                    disabled={verifyLoading || !content?.trim()}
                    className="ai-verify-btn group relative inline-flex w-fit items-center gap-2 rounded-xl bg-gradient-to-l from-violet-500 via-fuchsia-500 to-cyan-400 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/30 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
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
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <button
                  type="button"
                  onClick={handleSuggestions}
                  disabled={suggestionsLoading}
                  className="font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
                >
                  {suggestionsLoading ? "טוען…" : "הצעות לשיפור"}
                </button>
                <button
                  type="button"
                  onClick={handleValidateSuggestions}
                  disabled={suggestions.length === 0 || validationsLoading}
                  title={suggestions.length === 0 ? "לחץ קודם על «הצעות לשיפור»" : undefined}
                  className="font-medium text-[var(--primary)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {validationsLoading ? "בודק…" : "AI יבדוק אם ההצעות נכונות"}
                </button>
              </div>
              <PrimaryButton onClick={() => goToStage("completion")}>
                הכתבה מוכנה
              </PrimaryButton>
                </div>
              </>
            )}
          </div>
        </div>

        {/* פאנל עוזר AI */}
        {!panelCollapsed && (
          <aside className="flex w-[380px] shrink-0 flex-col border-r border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--primary)]">
                  auto_fix_high
                </span>
                <h3 className="font-bold text-foreground">עוזר כתיבה AI</h3>
              </div>
              <button
                type="button"
                onClick={() => setPanelCollapsed(true)}
                className="rounded p-1 text-muted transition-colors hover:text-foreground"
                aria-label="סגור פאנל"
              >
                <span className="material-symbols-outlined">close_fullscreen</span>
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              {/* מה תרצה שה-AI יעשה */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-muted">
                  מה תרצה שה-AI יעשה?
                </label>
                <div className="relative">
                  <textarea
                    value={customInstruction}
                    onChange={(e) => setCustomInstruction(e.target.value)}
                    placeholder="למשל: תכתוב פסקה על השקעות הון סיכון בבינה מלאכותית בשנת 2024..."
                    rows={4}
                    className="min-h-[120px] w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    dir="rtl"
                  />
                  <button
                    type="button"
                    onClick={handleCustomSend}
                    disabled={!customInstruction.trim() || customSendLoading}
                    className="absolute bottom-3 left-3 rounded-lg bg-[var(--primary)] p-2 text-white transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="שלח"
                  >
                    <span className="material-symbols-outlined">
                      {customSendLoading ? "progress_activity" : "send"}
                    </span>
                  </button>
                </div>
              </div>

              {/* פעולות מהירות */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-muted">
                  פעולות מהירות
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {QUICK_ACTIONS.map(({ key, icon, label }) => {
                    const loading =
                      (key === "expand" && expandLoading) ||
                      (key === "sources" && sourcesLoading);
                    const onClick =
                      key === "expand"
                        ? handleExpandParagraph
                        : key === "sources"
                          ? handleSources
                          : showComingSoon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={onClick}
                        disabled={loading}
                        className="group flex items-center gap-3 rounded-lg border border-border bg-transparent px-4 py-3 text-foreground transition-colors hover:bg-card disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-[var(--primary)] transition-transform group-hover:scale-110">
                          {loading ? "progress_activity" : icon}
                        </span>
                        <span className="text-sm font-medium">{label}</span>
                      </button>
                    );
                  })}
                </div>
                {sourcesResult && sourcesResult.length > 0 && (
                  <div className="rounded-xl border border-border bg-background p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-foreground">מקורות וסימוכין</span>
                      <button
                        type="button"
                        onClick={() => setSourcesResult(null)}
                        className="text-muted hover:text-foreground"
                        aria-label="סגור"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                    <ul className="mb-3 max-h-40 space-y-1.5 overflow-y-auto text-xs">
                      {sourcesResult.map((s, idx) => (
                        <li key={idx} className="flex flex-col gap-0.5">
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[var(--primary)] hover:underline"
                          >
                            {s.title}
                          </a>
                          {s.description && (
                            <span className="text-muted">{s.description}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={handleAddSourcesToDocument}
                      className="w-full rounded-lg bg-[var(--primary)] py-2 text-xs font-bold text-white transition-colors hover:opacity-90"
                    >
                      הוסף מקורות לסוף המאמר
                    </button>
                  </div>
                )}
              </div>

              {/* הצעה לשיפור */}
              {(firstSuggestion || suggestionsLoading) && (
                <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/10 p-4">
                  <div className="mb-2 flex items-center gap-2 text-[var(--primary)]">
                    <span className="material-symbols-outlined text-sm">lightbulb</span>
                    <span className="text-sm font-bold">הצעה לשיפור</span>
                  </div>
                  {suggestionsLoading ? (
                    <p className="text-xs leading-relaxed text-muted">טוען הצעות…</p>
                  ) : (
                    <>
                      <p className="text-xs leading-relaxed text-foreground">
                        {firstSuggestion}
                      </p>
                      {suggestions.length > 1 && (
                        <p className="mt-1 text-xs text-muted">
                          +{suggestions.length - 1} הצעות נוספות (ראה למעלה)
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={handleValidateSuggestions}
                        disabled={validationsLoading}
                        className="mt-3 text-xs font-bold text-[var(--primary)] hover:underline disabled:opacity-50"
                      >
                        AI יבדוק אם ההצעה נכונה
                      </button>
                    </>
                  )}
                </div>
              )}

              {suggestions.length > 1 && (
                <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
                  {suggestions.slice(1, 5).map((s, idx) => {
                    const validation = validations?.[idx + 1];
                    return (
                      <li key={idx} className="flex flex-col gap-0.5">
                        <span>{s}</span>
                        {validation !== undefined && (
                          <span
                            className={`text-xs font-medium ${
                              validation.valid ? "text-emerald-400" : "text-amber-400"
                            }`}
                          >
                            {validation.valid
                              ? "✓ נכון"
                              : `לא רלוונטי${validation.reason ? `: ${validation.reason}` : ""}`}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="border-t border-border p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className="text-xs text-muted">שימוש במשאבים</span>
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-card">
                  <div
                    className="h-full rounded-full bg-[var(--primary)]"
                    style={{ width: "65%" }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryPanel((v) => !v)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-card py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-card-hover"
              >
                <span className="material-symbols-outlined text-sm">history</span>
                {showHistoryPanel ? "סגור היסטוריה" : "הצג היסטוריית שינויים"}
              </button>
              {showHistoryPanel && (
                <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-2">
                  {contentHistory.length === 0 ? (
                    <p className="py-2 text-center text-xs text-muted">
                      עדיין אין גרסאות שמורות. העריכה נשמרת אוטומטית כל 12 שניות.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {contentHistory.map((entry, idx) => (
                        <li key={`${entry.at}-${idx}`} className="flex items-center justify-between gap-2 rounded border border-border bg-card px-2 py-1.5">
                          <span className="truncate text-xs text-foreground">
                            {new Date(entry.at).toLocaleTimeString("he-IL", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRestoreHistory(entry)}
                            className="text-xs font-bold text-[var(--primary)] hover:underline"
                          >
                            שחזר
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}

        {panelCollapsed && (
          <button
            type="button"
            onClick={() => setPanelCollapsed(false)}
            className="fixed bottom-6 end-6 z-40 flex items-center gap-2 rounded-full border border-[var(--primary)]/30 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-xl"
            aria-label="פתח עוזר AI"
          >
            <span className="material-symbols-outlined text-[var(--primary)]">
              auto_fix_high
            </span>
            עוזר AI
          </button>
        )}
      </div>
    </div>
  );
}
