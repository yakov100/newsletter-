"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/state/session-context";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { RichEditor } from "@/components/editor/RichEditor";
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

const PROVIDER_LABELS: Record<DraftProvider, string> = {
  openai: "OpenAI",
  mini: "Mini (Gemini)",
  cloud: "Cloud (Anthropic / Claude)",
};

export function WritingStage() {
  const { session, setDraftContent, setOutline, goToStage } = useSession();
  const { selectedIdea, outline, draftContent } = session;
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [useAllThree, setUseAllThree] = useState(true);
  const [allDrafts, setAllDrafts] = useState<{
    drafts: Partial<Record<DraftProvider, string>>;
    errors: Partial<Record<DraftProvider, string>>;
  } | null>(null);

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
    setAllDrafts(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedIdea.title,
          description: selectedIdea.description,
          outline,
          generateAll: useAllThree,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setAllDrafts({ drafts: {}, errors: { openai: data.error } });
        return;
      }
      if (useAllThree && (data.drafts || data.errors)) {
        setAllDrafts({
          drafts: data.drafts ?? {},
          errors: data.errors ?? {},
        });
        return;
      }
      if (data.draft) setDraftContent(draftTextToHtml(data.draft));
    } finally {
      setDraftLoading(false);
    }
  }

  function selectDraft(provider: DraftProvider, text: string) {
    setDraftContent(draftTextToHtml(text));
    setAllDrafts(null);
  }

  const providers: DraftProvider[] = ["openai", "mini", "cloud"];
  const hasDraftsToChoose = allDrafts && (Object.keys(allDrafts.drafts).length > 0);

  if (!selectedIdea) return null;

  return (
    <div className="flex flex-col gap-8 py-12 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-[var(--foreground)]">
        {selectedIdea.title}
      </h1>
      {(outlineLoading || outline) && (
        <div className="rounded-2xl border border-[var(--border)] p-5 bg-[var(--background-subtle)]/80 dark:bg-[var(--card)]/50">
          <h2 className="text-sm font-semibold text-[var(--foreground-muted)] uppercase tracking-wide mb-3">
            שלד מוצע
          </h2>
          {outlineLoading ? (
            <p className="text-[var(--foreground-muted)] text-sm flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
              טוען שלד…
            </p>
          ) : (
            <>
              <p className="text-[var(--foreground-muted)] text-xs mb-2">
                אפשר לערוך ולהוסיף נקודות משלך – הטיוטה תיכתב לפי השלד המעודכן.
              </p>
              <textarea
                value={outline}
                onChange={(e) => setOutline(e.target.value)}
                className="w-full min-h-[140px] p-3 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] font-sans text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="שלד הכתבה…"
                dir="rtl"
              />
            </>
          )}
        </div>
      )}
      {outline && !outlineLoading && (
        <div className="flex flex-col gap-3 items-end">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--foreground-muted)]">
            <input
              type="checkbox"
              checked={useAllThree}
              onChange={(e) => setUseAllThree(e.target.checked)}
              className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
            />
            <span>
              הפעל את שלושת המודלים (OpenAI, Mini, Anthropic) ובחר איזה טיוטה עדיפה
            </span>
          </label>
          <PrimaryButton
            onClick={generateDraft}
            disabled={draftLoading || !outline.trim()}
          >
            {draftLoading ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ml-2" />
                {useAllThree ? "כותב שלוש טיוטות…" : "כותב טיוטה…"}
              </>
            ) : draftContent ? (
              "כתוב טיוטה מחדש"
            ) : (
              useAllThree
                ? "כתוב שלוש טיוטות ובחר"
                : "כתוב טיוטה לפי השלד"
            )}
          </PrimaryButton>
        </div>
      )}

      {hasDraftsToChoose && allDrafts && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            בחר איזו טיוטה עדיפה
          </h2>
          <div className="grid gap-4">
            {providers.map((provider) => {
              const draft = allDrafts.drafts[provider];
              const error = allDrafts.errors[provider];
              const label = PROVIDER_LABELS[provider];
              if (error && !draft) {
                return (
                  <div
                    key={provider}
                    className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30 p-4"
                  >
                    <p className="font-medium text-[var(--foreground)]">{label}</p>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      {error}
                    </p>
                  </div>
                );
              }
              if (!draft) return null;
              return (
                <div
                  key={provider}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-[var(--foreground)]">{label}</p>
                    <PrimaryButton
                      onClick={() => selectDraft(provider, draft)}
                      className="text-sm py-1.5 px-3"
                    >
                      בחר טיוטה זו
                    </PrimaryButton>
                  </div>
                  <div
                    className="text-sm text-[var(--foreground-muted)] leading-relaxed line-clamp-6 whitespace-pre-wrap border-t border-[var(--border)] pt-3"
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

      <div>
        <label className="block text-sm font-semibold text-[var(--foreground-muted)] mb-2">
          הכתבה שלך
        </label>
        {draftLoading && !hasDraftsToChoose ? (
          <div className="rounded-2xl border border-[var(--border)] p-8 bg-[var(--background-subtle)]/80 min-h-[200px] flex items-center justify-center">
            <p className="text-[var(--foreground-muted)] text-sm flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
              כותב טיוטה…
            </p>
          </div>
        ) : (
          <RichEditor
            value={draftContent}
            onChange={setDraftContent}
            placeholder="לחץ על «כתוב טיוטה לפי השלד» (או «כתוב שלוש טיוטות») כדי ליצור את הכתבה"
          />
        )}
      </div>
      <PrimaryButton onClick={() => goToStage("editing")} className="self-end">
        המשך לעריכה
      </PrimaryButton>
    </div>
  );
}
