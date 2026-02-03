"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/state/session-context";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export function CompletionStage() {
  const { session, resetSession } = useSession();
  const { selectedIdea, editedContent, draftContent } = session;
  const finalContent = editedContent || draftContent;
  const [archiveStatus, setArchiveStatus] = useState<"idle" | "loading" | "ok" | "err" | "auth">("idle");
  const [archiveMessage, setArchiveMessage] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleCopy = async () => {
    const plain = finalContent.replace(/<[^>]+>/g, "").trim();
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

  return (
    <div className="flex flex-col gap-10 py-12 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">
        סיום
      </h1>
      {selectedIdea && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground-muted)] uppercase tracking-wide mb-1">
            כותרת
          </h2>
          <p className="text-lg font-medium text-[var(--foreground)]">
            {selectedIdea.title}
          </p>
        </div>
      )}
      <div className="rounded-2xl border border-[var(--border)] p-5 bg-[var(--background-subtle)]/80 max-h-72 overflow-y-auto shadow-[var(--shadow)]">
        <div
          className="prose prose-slate dark:prose-invert prose-sm max-w-none text-[var(--foreground)]"
          dangerouslySetInnerHTML={{
            __html: finalContent || "<p>אין תוכן.</p>",
          }}
        />
      </div>
      {(archiveMessage === "התחבר כדי לשמור לארכיון" || archiveStatus === "auth") && (
        <p className="text-sm text-[var(--foreground-muted)] text-center">
          <Link href="/auth" className="text-[var(--accent)] font-medium hover:underline">
            התחבר
          </Link>
          {" "}
          כדי לשמור לארכיון
        </p>
      )}
      {archiveStatus === "ok" && (
        <p className="text-sm text-green-600 dark:text-green-400 text-center font-medium" role="status">
          {archiveMessage}
        </p>
      )}
      {archiveStatus === "err" && archiveMessage && (
        <p className="text-sm text-red-600 dark:text-red-400 text-center font-medium" role="alert">
          {archiveMessage}
        </p>
      )}
      {copyFeedback && (
        <p className="text-sm text-green-600 dark:text-green-400 text-center font-medium" role="status">
          הועתק ללוח
        </p>
      )}
      <div className="flex flex-wrap gap-4 justify-center">
        <PrimaryButton onClick={handleCopy}>
          {copyFeedback ? "הועתק" : "העתק ללוח"}
        </PrimaryButton>
        <PrimaryButton
          onClick={handleSaveToArchive}
          disabled={archiveStatus === "loading"}
        >
          {archiveStatus === "loading" ? "שומר…" : "שמירה לארכיון"}
        </PrimaryButton>
        <PrimaryButton variant="secondary" onClick={resetSession}>
          חזרה לרעיונות
        </PrimaryButton>
      </div>
    </div>
  );
}
