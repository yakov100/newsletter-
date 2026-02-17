"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/state/session-context";
import type { OutlineValidationResult } from "@/lib/ai/validate-outline";

export function CompletionStage() {
  const { session, resetSession, goToStage, setDraftValidation } = useSession();
  const { selectedIdea, editedContent, draftContent, draftValidation } = session;
  const finalContent = editedContent || draftContent;
  const [archiveStatus, setArchiveStatus] = useState<"idle" | "loading" | "ok" | "err" | "auth">("idle");
  const [archiveMessage, setArchiveMessage] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [finalCheckLoading, setFinalCheckLoading] = useState(false);
  const [finalCheckResult, setFinalCheckResult] = useState<OutlineValidationResult | null>(draftValidation);
  const [showPdfConfirm, setShowPdfConfirm] = useState(false);

  const isVerified = finalCheckResult?.allVerified === true;

  const handleFinalCheck = async () => {
    const plain = (finalContent || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!plain) return;
    setFinalCheckLoading(true);
    try {
      const res = await fetch("/api/validate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedIdea?.title ?? "",
          description: selectedIdea?.description ?? "",
          draft: plain,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const result: OutlineValidationResult = {
        items: data.items ?? [],
        summary: data.summary ?? "",
        allVerified: Boolean(data.allVerified),
        usedWebSearch: Boolean(data.usedWebSearch),
      };
      setFinalCheckResult(result);
      setDraftValidation(result);
    } catch {
      setFinalCheckResult({
        items: [],
        summary: "שגיאה באימות – נסה שוב",
        allVerified: false,
        usedWebSearch: false,
      });
    } finally {
      setFinalCheckLoading(false);
    }
  };

  const handleCopy = async () => {
    const plain = (finalContent || "").replace(/<[^>]+>/g, "").trim();
    await navigator.clipboard.writeText(plain);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleSaveToArchive = async () => {
    const title = selectedIdea?.title ?? "כתבה ללא כותרת";
    const plain = (finalContent || "").replace(/<[^>]+>/g, "").trim();
    setArchiveStatus("loading");
    setArchiveMessage("");
    try {
      const res = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: plain || "", verified: isVerified }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setArchiveStatus("auth");
        setArchiveMessage("התחבר כדי לשמור לארכיון");
        return;
      }
      if (!res.ok) {
        setArchiveStatus("err");
        setArchiveMessage(data.error ?? "שגיאה בשמירה");
        return;
      }
      setArchiveStatus("ok");
      setArchiveMessage("נשמר בארכיון");
    } catch {
      setArchiveStatus("err");
      setArchiveMessage("שגיאה בשמירה");
    } finally {
      setArchiveStatus((s) => (s === "loading" ? "idle" : s));
    }
  };

  const savedSuccess = archiveStatus === "ok";
  const dateLabel = new Date().toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleDownloadPdf = async () => {
    const title = selectedIdea?.title ?? "כתבה ללא כותרת";
    const fileName = `${title.replace(/[^\p{L}\p{N}\s-]/gu, "").trim() || "article"}.pdf`;

    setPdfLoading(true);
    setShareFeedback("");

    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          dateLabel,
          htmlContent: finalContent || "<p>אין תוכן.</p>",
          verified: isVerified,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "PDF failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "יצירת PDF נכשלה — נסה שוב";
      setShareFeedback(msg);
      setTimeout(() => setShareFeedback(""), 5000);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleShare = async () => {
    const title = selectedIdea?.title ?? "כתבה ללא כותרת";
    const plain = (finalContent || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1000);
    const text = `${title}\n\n${plain}${plain.length >= 1000 ? "…" : ""}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title,
          text,
        });
        setShareFeedback("התוכן שותף");
        setTimeout(() => setShareFeedback(""), 2500);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setShareFeedback("השיתוף נכשל");
          setTimeout(() => setShareFeedback(""), 2500);
        }
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareFeedback("הועתק ללוח — ניתן לשתף בהדבקה");
      setTimeout(() => setShareFeedback(""), 2500);
    } catch {
      setShareFeedback("לא ניתן להעתיק");
      setTimeout(() => setShareFeedback(""), 2500);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Step Progress Bar */}
      <div className="mb-10">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold text-[var(--primary)]">שלב 5: סיום ושמירה</p>
            <p className="text-sm font-medium text-foreground">100%</p>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-card">
            <div
              className="h-full w-full rounded-full bg-[var(--primary)] shadow-[0_0_10px_rgba(99,102,241,0.5)]"
            />
          </div>
          <p className="text-sm text-muted">
            התהליך הושלם בהצלחה! הכתבה שלך מוכנה.
          </p>
        </div>
      </div>

      {/* Feedback toast (share / PDF) */}
      {shareFeedback && (
        <div
          role="status"
          className="fixed bottom-6 start-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground shadow-xl"
        >
          {shareFeedback}
        </div>
      )}

      {/* Success Toast (when saved) */}
      {savedSuccess && (
        <div className="mb-6 flex flex-col rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-[var(--primary)]">
              check_circle
            </span>
            <div className="flex flex-col">
              <p className="font-bold leading-tight text-foreground">הכתבה נשמרה בהצלחה!</p>
              <p className="text-sm text-muted">
                התוכן זמין כעת בארכיון האישי שלך וניתן להעתקה.
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2 sm:mt-0">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-[var(--primary)]/20 transition-all hover:opacity-90"
            >
              <span className="material-symbols-outlined text-sm">folder_open</span>
              צפה בארכיון
            </Link>
          </div>
        </div>
      )}

      {/* Article Preview Card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-foreground">תצוגה מקדימה</h3>
            {finalCheckResult && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                isVerified
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
              }`}>
                <span className="material-symbols-outlined text-sm">
                  {isVerified ? "verified" : "warning"}
                </span>
                {isVerified ? "מאומת" : "לא מאומת"}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleFinalCheck}
              disabled={finalCheckLoading}
              className="ai-verify-btn group relative inline-flex items-center gap-2 rounded-lg bg-gradient-to-l from-violet-500 via-fuchsia-500 to-cyan-400 px-3 py-1.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-sm">fact_check</span>
              {finalCheckLoading ? "בודק…" : "בדיקה סופית"}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-card"
            >
              <span className="material-symbols-outlined text-sm">content_copy</span>
              {copyFeedback ? "הועתק" : "העתק ללוח"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!finalCheckResult && !showPdfConfirm) {
                  setShowPdfConfirm(true);
                  return;
                }
                setShowPdfConfirm(false);
                handleDownloadPdf();
              }}
              disabled={pdfLoading}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-card disabled:opacity-50"
              title="הדפס / שמור כ-PDF"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              {pdfLoading ? "מכין…" : "הורד PDF"}
            </button>
          </div>
        </div>
        {showPdfConfirm && (
          <div className="border-b border-amber-500/50 bg-amber-500/10 px-6 py-3 flex items-center justify-between" dir="rtl">
            <span className="text-sm text-amber-800 dark:text-amber-200">הכתבה לא עברה בדיקת אימות סופית. להמשיך?</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPdfConfirm(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-muted hover:text-foreground"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => { setShowPdfConfirm(false); handleDownloadPdf(); }}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
              >
                הורד בכל זאת
              </button>
            </div>
          </div>
        )}
        {finalCheckResult && !finalCheckResult.allVerified && finalCheckResult.items.length > 0 && (
          <div className="border-b border-border bg-violet-50/50 px-6 py-3 dark:bg-violet-950/20" dir="rtl">
            <p className="mb-2 text-sm font-bold text-foreground">{finalCheckResult.summary}</p>
            <ul className="space-y-1">
              {finalCheckResult.items.filter((i) => i.status !== "ok").map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={`material-symbols-outlined text-sm mt-0.5 ${
                    item.status === "warning" ? "text-amber-500" : "text-slate-400"
                  }`}>
                    {item.status === "warning" ? "warning" : "help"}
                  </span>
                  <span className="text-foreground">{item.text}{item.reason ? ` — ${item.reason}` : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Content */}
        <div className="p-8 sm:p-12">
          <header className="mb-8 border-b border-border pb-8">
            <h1 className="mb-4 text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
              {selectedIdea?.title ?? "כתבה ללא כותרת"}
            </h1>
            <div className="flex items-center gap-3 text-sm text-muted">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/20 text-[var(--primary)]">
                <span className="material-symbols-outlined text-xs">auto_awesome</span>
              </div>
              <span>נוצר על ידי עוזר הכתיבה החכם</span>
              <span>•</span>
              <span>{dateLabel}</span>
            </div>
          </header>
          <article
            className="prose max-w-none space-y-6 text-lg leading-relaxed prose-p:text-foreground prose-headings:text-foreground"
            dangerouslySetInnerHTML={{
              __html: finalContent || "<p>אין תוכן.</p>",
            }}
          />
        </div>
      </div>

      {/* Errors / Auth */}
      {(archiveStatus === "auth" || archiveMessage === "התחבר כדי לשמור לארכיון") && (
        <p className="mt-4 text-center text-sm text-muted">
          <Link href="/auth" className="font-medium text-[var(--primary)] hover:underline">
            התחבר
          </Link>{" "}
          כדי לשמור לארכיון
        </p>
      )}
      {archiveStatus === "err" && archiveMessage && (
        <p className="mt-4 text-center text-sm font-medium text-red-400" role="alert">
          {archiveMessage}
        </p>
      )}

      {/* Bottom Actions */}
      <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-border pt-8 sm:flex-row">
        <button
          type="button"
          onClick={() => goToStage("editing")}
          className="flex items-center gap-2 font-medium text-muted transition-colors hover:text-[var(--primary)]"
        >
          <span className="material-symbols-outlined rotate-180">arrow_forward</span>
          חזור לעריכה
        </button>
        <div className="flex w-full gap-4 sm:w-auto">
          <button
            type="button"
            onClick={handleShare}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-card px-8 py-3 font-bold text-foreground transition-all hover:bg-card-hover sm:flex-none"
            title="שתף את הכתבה"
          >
            <span className="material-symbols-outlined">share</span>
            שתף
          </button>
          <button
            type="button"
            onClick={handleSaveToArchive}
            disabled={archiveStatus === "loading"}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-10 py-3 font-bold text-white shadow-xl shadow-[var(--primary)]/30 transition-all hover:opacity-90 disabled:opacity-50 sm:flex-none"
          >
            <span className="material-symbols-outlined">archive</span>
            {archiveStatus === "loading" ? "שומר…" : "שמור לארכיון"}
          </button>
        </div>
      </div>

      {/* Suggested Articles */}
      <section className="mt-20">
        <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-foreground">
          <span className="material-symbols-outlined text-[var(--primary)]">lightbulb</span>
          כתבות נוספות שאולי יעניינו אותך
        </h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <button
            type="button"
            onClick={resetSession}
            className="flex flex-col overflow-hidden rounded-xl border border-border bg-card text-right transition-shadow hover:shadow-lg"
          >
            <div className="aspect-video w-full bg-gradient-to-br from-[var(--primary)]/20 to-background-subtle" />
            <div className="p-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                טכנולוגיה
              </p>
              <h4 className="mb-2 text-lg font-bold text-foreground">
                10 כלים לשיפור הפרודוקטיביות ב-2024
              </h4>
              <p className="line-clamp-2 text-sm text-muted">
                גלו את הכלים שיעזרו לכם לנהל את הזמן שלכם טוב יותר ולסיים מטלות בקלות...
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={resetSession}
            className="flex flex-col overflow-hidden rounded-xl border border-border bg-card text-right transition-shadow hover:shadow-lg"
          >
            <div className="aspect-video w-full bg-gradient-to-br from-[var(--primary)]/10 to-background-subtle" />
            <div className="p-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                קריאייטיב
              </p>
              <h4 className="mb-2 text-lg font-bold text-foreground">
                איך למצוא השראה כשנגמרים הרעיונות
              </h4>
              <p className="line-clamp-2 text-sm text-muted">
                מדריך מעשי להתגברות על "מחסום כתיבה" ומציאת נקודות מבט חדשות ומעניינות...
              </p>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}
