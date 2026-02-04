"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/state/session-context";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { RichEditor, type RichEditorHandle } from "@/components/editor/RichEditor";

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
  { key: "outline", icon: "list_alt", label: "צור שלד למאמר" },
  { key: "expand", icon: "expand", label: "הרחב פסקה נבחרת" },
  { key: "sources", icon: "auto_stories", label: "הוסף מקורות וסימוכין" },
] as const;

function getTitleAndDescription(html: string): { title: string; description: string } {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const firstLine = text.split(/\n/)[0]?.trim() || "";
  const rest = text.slice(firstLine.length).trim().slice(0, 500);
  return {
    title: firstLine || "מאמר",
    description: rest,
  };
}

export function EditingStage() {
  const { session, setEditedContent, goToStage } = useSession();
  const { draftContent, editedContent } = session;
  const content = editedContent || draftContent;
  const editorRef = useRef<RichEditorHandle>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [validations, setValidations] = useState<SuggestionValidation[] | null>(null);
  const [validationsLoading, setValidationsLoading] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");
  const [customSendLoading, setCustomSendLoading] = useState(false);
  const [outlineResult, setOutlineResult] = useState<string | null>(null);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [expandLoading, setExpandLoading] = useState(false);
  const [sourcesResult, setSourcesResult] = useState<SourceReference[] | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [contentHistory, setContentHistory] = useState<HistoryEntry[]>([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const lastContentRef = useRef<string>("");
  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleQuickOutline = async () => {
    const text = content.replace(/<[^>]+>/g, " ").trim();
    if (!text) {
      setToast("אין תוכן ליצירת שלד");
      return;
    }
    setOutlineLoading(true);
    setOutlineResult(null);
    try {
      const { title, description } = getTitleAndDescription(content);
      const res = await fetch("/api/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const data = await res.json();
      if (data.outline) setOutlineResult(data.outline);
      else if (data.error) setToast(data.error);
    } finally {
      setOutlineLoading(false);
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
          className="fixed bottom-6 start-1/2 z-50 -translate-x-1/2 rounded-lg border border-white/20 bg-[#101622] px-4 py-3 text-sm text-white shadow-xl"
        >
          {toast}
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* אזור העורך */}
        <div className="flex flex-1 flex-col overflow-y-auto p-6">
          <div className="mx-auto w-full max-w-4xl">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#101622] shadow-sm">
              <RichEditor
                ref={editorRef}
                value={content}
                onChange={setEditedContent}
                placeholder="ערוך כאן…"
                onImproveText={handleSuggestions}
              />
            </div>
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
          </div>
        </div>

        {/* פאנל עוזר AI */}
        {!panelCollapsed && (
          <aside className="flex w-[380px] shrink-0 flex-col border-r border-white/10 bg-[#101622]">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--primary)]">
                  auto_fix_high
                </span>
                <h3 className="font-bold text-white">עוזר כתיבה AI</h3>
              </div>
              <button
                type="button"
                onClick={() => setPanelCollapsed(true)}
                className="rounded p-1 text-white/50 transition-colors hover:text-white"
                aria-label="סגור פאנל"
              >
                <span className="material-symbols-outlined">close_fullscreen</span>
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              {/* מה תרצה שה-AI יעשה */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-white/60">
                  מה תרצה שה-AI יעשה?
                </label>
                <div className="relative">
                  <textarea
                    value={customInstruction}
                    onChange={(e) => setCustomInstruction(e.target.value)}
                    placeholder="למשל: תכתוב פסקה על השקעות הון סיכון בבינה מלאכותית בשנת 2024..."
                    rows={4}
                    className="min-h-[120px] w-full resize-none rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
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
                <label className="text-sm font-bold text-white/60">
                  פעולות מהירות
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {QUICK_ACTIONS.map(({ key, icon, label }) => {
                    const loading =
                      (key === "outline" && outlineLoading) ||
                      (key === "expand" && expandLoading) ||
                      (key === "sources" && sourcesLoading);
                    const onClick =
                      key === "outline"
                        ? handleQuickOutline
                        : key === "expand"
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
                        className="group flex items-center gap-3 rounded-lg border border-white/10 bg-transparent px-4 py-3 text-white transition-colors hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-[var(--primary)] transition-transform group-hover:scale-110">
                          {loading ? "progress_activity" : icon}
                        </span>
                        <span className="text-sm font-medium">{label}</span>
                      </button>
                    );
                  })}
                </div>
                {outlineResult && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white/70">השלד שנוצר</span>
                      <button
                        type="button"
                        onClick={() => setOutlineResult(null)}
                        className="text-white/50 hover:text-white"
                        aria-label="סגור"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-white/80">
                      {outlineResult}
                    </pre>
                  </div>
                )}
                {sourcesResult && sourcesResult.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white/70">מקורות וסימוכין</span>
                      <button
                        type="button"
                        onClick={() => setSourcesResult(null)}
                        className="text-white/50 hover:text-white"
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
                            <span className="text-white/60">{s.description}</span>
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
                    <p className="text-xs leading-relaxed text-white/60">טוען הצעות…</p>
                  ) : (
                    <>
                      <p className="text-xs leading-relaxed text-white/70">
                        {firstSuggestion}
                      </p>
                      {suggestions.length > 1 && (
                        <p className="mt-1 text-xs text-white/50">
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
                <ul className="list-inside list-disc space-y-1 text-sm text-white/70">
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
            <div className="border-t border-white/10 p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className="text-xs text-white/50">שימוש במשאבים</span>
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[var(--primary)]"
                    style={{ width: "65%" }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryPanel((v) => !v)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/20"
              >
                <span className="material-symbols-outlined text-sm">history</span>
                {showHistoryPanel ? "סגור היסטוריה" : "הצג היסטוריית שינויים"}
              </button>
              {showHistoryPanel && (
                <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-2">
                  {contentHistory.length === 0 ? (
                    <p className="py-2 text-center text-xs text-white/50">
                      עדיין אין גרסאות שמורות. העריכה נשמרת אוטומטית כל 12 שניות.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {contentHistory.map((entry, idx) => (
                        <li key={`${entry.at}-${idx}`} className="flex items-center justify-between gap-2 rounded border border-white/10 bg-white/5 px-2 py-1.5">
                          <span className="truncate text-xs text-white/70">
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
            className="fixed bottom-6 end-6 z-40 flex items-center gap-2 rounded-full border border-[var(--primary)]/30 bg-[#101622] px-4 py-2 text-sm font-medium text-white shadow-xl"
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
