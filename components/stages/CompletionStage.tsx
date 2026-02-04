"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/state/session-context";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export function CompletionStage() {
  const { session, resetSession, goToStage } = useSession();
  const { selectedIdea, editedContent, draftContent } = session;
  const finalContent = editedContent || draftContent;
  const [archiveStatus, setArchiveStatus] = useState<"idle" | "loading" | "ok" | "err" | "auth">("idle");
  const [archiveMessage, setArchiveMessage] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");

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
        body: JSON.stringify({ title, content: plain || "" }),
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
    const htmlContent = finalContent || "<p>אין תוכן.</p>";
    const safeTitle = title.replace(/</g, "&lt;");

    setPdfLoading(true);
    setShareFeedback("");

    const container = document.createElement("div");
    container.dir = "rtl";
    container.lang = "he";
    container.style.cssText = [
      "position:fixed",
      "left:-9999px",
      "top:0",
      "width:794px",
      "padding:40px",
      "backgroundColor:#fff",
      "color:#0f172a",
      "fontFamily:'Heebo','Assistant',sans-serif",
      "boxSizing:border-box",
    ].join(";");

    container.innerHTML = `
      <h1 style="fontSize:28px;marginBottom:8px;">${safeTitle}</h1>
      <div style="color:#64748b;fontSize:14px;marginBottom:24px;">${dateLabel}</div>
      <article style="lineHeight:1.7;">
        ${htmlContent}
      </article>
    `;

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      document.body.removeChild(container);

      const pdf = new jsPDF("p", "pt", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 40;
      const contentW = pageW - margin * 2;
      const imgW = contentW;
      const imgH = (canvas.height * contentW) / canvas.width;
      const imgData = canvas.toDataURL("image/png", 1.0);
      const pageHeight = pageH - margin * 2;
      let heightLeft = imgH;
      let pageNum = 0;

      pdf.addImage(imgData, "PNG", margin, margin, imgW, imgH);
      heightLeft -= pageHeight;
      pageNum = 1;

      while (heightLeft > 0) {
        pdf.addPage();
        const y = margin - pageNum * pageHeight;
        pdf.addImage(imgData, "PNG", margin, y, imgW, imgH);
        heightLeft -= pageHeight;
        pageNum++;
      }

      const fileName = `${title.replace(/[^\p{L}\p{N}\s-]/gu, "").trim() || "article"}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      document.body.contains(container) && document.body.removeChild(container);
      setShareFeedback("יצירת PDF נכשלה — נסה שוב");
      setTimeout(() => setShareFeedback(""), 3000);
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
            <p className="text-sm font-medium text-white/80">100%</p>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full w-full rounded-full bg-[var(--primary)] shadow-[0_0_10px_rgba(19,91,236,0.5)]"
            />
          </div>
          <p className="text-sm text-white/50">
            התהליך הושלם בהצלחה! הכתבה שלך מוכנה.
          </p>
        </div>
      </div>

      {/* Feedback toast (share / PDF) */}
      {shareFeedback && (
        <div
          role="status"
          className="fixed bottom-6 start-1/2 z-50 -translate-x-1/2 rounded-lg border border-white/20 bg-[#101622] px-4 py-3 text-sm text-white shadow-xl"
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
              <p className="font-bold leading-tight text-white">הכתבה נשמרה בהצלחה!</p>
              <p className="text-sm text-white/60">
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
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] shadow-xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4">
          <h3 className="font-bold text-white/80">תצוגה מקדימה</h3>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              <span className="material-symbols-outlined text-sm">content_copy</span>
              {copyFeedback ? "הועתק" : "העתק ללוח"}
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50"
              title="הדפס / שמור כ-PDF"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              {pdfLoading ? "מכין…" : "הורד PDF"}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 sm:p-12">
          <header className="mb-8 border-b border-white/10 pb-8">
            <h1 className="mb-4 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
              {selectedIdea?.title ?? "כתבה ללא כותרת"}
            </h1>
            <div className="flex items-center gap-3 text-sm text-white/50">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/20 text-[var(--primary)]">
                <span className="material-symbols-outlined text-xs">auto_awesome</span>
              </div>
              <span>נוצר על ידי עוזר הכתיבה החכם</span>
              <span>•</span>
              <span>{dateLabel}</span>
            </div>
          </header>
          <article
            className="prose prose-invert max-w-none space-y-6 text-lg leading-relaxed prose-p:text-white/80 prose-headings:text-white"
            dangerouslySetInnerHTML={{
              __html: finalContent || "<p>אין תוכן.</p>",
            }}
          />
        </div>
      </div>

      {/* Errors / Auth */}
      {(archiveStatus === "auth" || archiveMessage === "התחבר כדי לשמור לארכיון") && (
        <p className="mt-4 text-center text-sm text-white/70">
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
      <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-white/10 pt-8 sm:flex-row">
        <button
          type="button"
          onClick={() => goToStage("editing")}
          className="flex items-center gap-2 font-medium text-white/60 transition-colors hover:text-[var(--primary)]"
        >
          <span className="material-symbols-outlined rotate-180">arrow_forward</span>
          חזור לעריכה
        </button>
        <div className="flex w-full gap-4 sm:w-auto">
          <button
            type="button"
            onClick={handleShare}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-8 py-3 font-bold text-white transition-all hover:bg-white/20 sm:flex-none"
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
        <h3 className="mb-6 flex items-center gap-2 text-xl font-bold text-white">
          <span className="material-symbols-outlined text-[var(--primary)]">lightbulb</span>
          כתבות נוספות שאולי יעניינו אותך
        </h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <button
            type="button"
            onClick={resetSession}
            className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 text-right transition-shadow hover:shadow-lg"
          >
            <div className="aspect-video w-full bg-gradient-to-br from-[var(--primary)]/20 to-white/5" />
            <div className="p-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                טכנולוגיה
              </p>
              <h4 className="mb-2 text-lg font-bold text-white">
                10 כלים לשיפור הפרודוקטיביות ב-2024
              </h4>
              <p className="line-clamp-2 text-sm text-white/50">
                גלו את הכלים שיעזרו לכם לנהל את הזמן שלכם טוב יותר ולסיים מטלות בקלות...
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={resetSession}
            className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 text-right transition-shadow hover:shadow-lg"
          >
            <div className="aspect-video w-full bg-gradient-to-br from-[var(--primary)]/10 to-white/5" />
            <div className="p-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                קריאייטיב
              </p>
              <h4 className="mb-2 text-lg font-bold text-white">
                איך למצוא השראה כשנגמרים הרעיונות
              </h4>
              <p className="line-clamp-2 text-sm text-white/50">
                מדריך מעשי להתגברות על "מחסום כתיבה" ומציאת נקודות מבט חדשות ומעניינות...
              </p>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}
