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

type ModelChoice = "openai" | "mini" | "cloud" | "all";

const MODEL_OPTIONS: {
  value: ModelChoice;
  label: string;
  sublabel: string;
  icon: string;
  iconBg: string;
  iconColor: string;
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
    label: "Gemini (Mini)",
    sublabel: "יעיל ומהיר מאוד",
    icon: "google",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
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
  const [selectedModel, setSelectedModel] = useState<ModelChoice>("openai");
  const [allDrafts, setAllDrafts] = useState<{
    drafts: Partial<Record<DraftProvider, string>>;
    errors: Partial<Record<DraftProvider, string>>;
  } | null>(null);

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
    setAllDrafts(null);
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
        setAllDrafts({ drafts, errors });
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
    }
  }

  function selectDraft(provider: DraftProvider, text: string) {
    setDraftContent(draftTextToHtml(text));
    setAllDrafts(null);
  }

  const providers: DraftProvider[] = ["openai", "mini", "cloud"];
  const hasDraftsToChoose = allDrafts && selectedModel === "all" && Object.keys(allDrafts.drafts).length > 0;

  if (!selectedIdea) return null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      {/* שלד הכתבה */}
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">שלד הכתבה</h1>
          <p className="text-white/60">
            עבור על הסעיפים שנוצרו, ערוך אותם במידת הצורך ואשר את המבנה ליצירת הטיוטה.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#101622] shadow-sm">
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

            {/* שלד (תוכן עריכה) */}
            {outlineLoading ? (
              <p className="flex items-center gap-2 text-sm text-white/60">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
                טוען שלד…
              </p>
            ) : outline ? (
              <div className="outline-item flex items-start gap-4 rounded-lg border border-white/10 p-4 transition-all hover:border-[var(--primary)]/30">
                <span className="material-symbols-outlined mt-1 cursor-move text-white/40">
                  drag_handle
                </span>
                <div className="flex-1">
                  <textarea
                    value={outline}
                    onChange={(e) => setOutline(e.target.value)}
                    className="min-h-[140px] w-full resize-y border-none bg-transparent p-0 text-sm leading-relaxed text-white placeholder:text-white/40 focus:ring-0"
                    placeholder="שלד הכתבה…"
                    dir="rtl"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* אשר את השלד ובחר מודל */}
      <div className="space-y-6 rounded-xl border border-white/10 bg-[#101622] p-8 shadow-sm">
        <div className="text-center space-y-1">
          <h3 className="text-xl font-bold text-white">
            אשר את השלד ובחר מודל לכתיבת הטיוטה
          </h3>
          <p className="text-sm text-white/60">
            הטיוטה תיווצר באופן אוטומטי על בסיס הסעיפים שאושרו למעלה
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  "flex flex-col items-center gap-3 rounded-xl border p-4 transition-all " +
                  (selectedModel === opt.value
                    ? "border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]"
                    : "border-white/10 group-hover:bg-white/5")
                }
              >
                <div
                  className={`size-10 rounded-full flex items-center justify-center ${opt.iconBg} ${opt.iconColor}`}
                >
                  <span className="material-symbols-outlined">{opt.icon}</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-white">{opt.label}</p>
                  <p className="text-[10px] text-white/50">{opt.sublabel}</p>
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex flex-col items-center gap-4 pt-4">
          <button
            type="button"
            onClick={generateDraft}
            disabled={draftLoading || !outline?.trim()}
            className="flex w-full max-w-md items-center justify-center gap-3 rounded-xl bg-[var(--primary)] py-4 text-lg font-bold text-white shadow-xl shadow-[var(--primary)]/30 transition-all hover:opacity-90 disabled:opacity-50"
          >
            {draftLoading ? (
              <>
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                כותב טיוטה…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">magic_button</span>
                צור טיוטה ועבור לעורך
              </>
            )}
          </button>
          <p className="text-xs text-white/50">
            בלחיצה, המערכת תתחיל בתהליך הכתיבה. זה עשוי לקחת כ-30 שניות.
          </p>
        </div>
      </div>

      {/* בחירת טיוטה (רק כשבחר "הכל" ויש כמה טיוטות) */}
      {hasDraftsToChoose && allDrafts && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">בחר איזו טיוטה עדיפה</h2>
          <div className="grid gap-4">
            {providers.map((provider) => {
              const draft = allDrafts.drafts[provider];
              const error = allDrafts.errors[provider];
              const label = PROVIDER_LABELS[provider];
              if (error && !draft) {
                return (
                  <div
                    key={provider}
                    className="rounded-xl border border-red-800 bg-red-950/30 p-4"
                  >
                    <p className="font-medium text-white">{label}</p>
                    <p className="mt-1 text-sm text-red-400">{error}</p>
                  </div>
                );
              }
              if (!draft) return null;
              return (
                <div
                  key={provider}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-white">{label}</p>
                    <PrimaryButton
                      onClick={() => selectDraft(provider, draft)}
                      className="px-3 py-1.5 text-sm"
                    >
                      בחר טיוטה זו
                    </PrimaryButton>
                  </div>
                  <div
                    className="line-clamp-6 whitespace-pre-wrap border-t border-white/10 pt-3 text-sm leading-relaxed text-white/60"
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

      {/* אזור העורך – נעול עד שיש טיוטה */}
      <div className="relative">
        {!draftContent && !draftLoading ? (
          <div className="relative select-none opacity-25 grayscale pointer-events-none">
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-6 py-3 shadow-xl backdrop-blur-sm">
                <span className="material-symbols-outlined animate-pulse text-white">lock</span>
                <span className="text-sm font-bold text-white">
                  העורך ייפתח לאחר יצירת הטיוטה
                </span>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#101622]">
              <div className="flex h-10 items-center gap-4 border-b border-white/10 bg-white/5 px-4">
                <span className="h-4 w-4 rounded bg-white/20" />
                <span className="h-4 w-4 rounded bg-white/20" />
                <span className="h-4 w-4 rounded bg-white/20" />
              </div>
              <div className="space-y-4 p-12">
                <div className="h-8 w-3/4 rounded bg-white/10" />
                <div className="h-4 w-full rounded bg-white/10" />
                <div className="h-4 w-full rounded bg-white/10" />
                <div className="h-4 w-2/3 rounded bg-white/10" />
              </div>
            </div>
          </div>
        ) : draftLoading && !hasDraftsToChoose ? (
          <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-white/10 bg-white/5 p-8">
            <p className="flex items-center gap-2 text-sm text-white/60">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
              כותב טיוטה…
            </p>
          </div>
        ) : (
          <>
            <label className="mb-2 block text-sm font-semibold text-white/70">
              הכתבה שלך
            </label>
            <RichEditor
              value={draftContent}
              onChange={setDraftContent}
              placeholder="ערוך כאן את הטיוטה…"
            />
            <PrimaryButton
              onClick={() => goToStage("editing")}
              className="mt-4 self-end"
            >
              המשך לעריכה
            </PrimaryButton>
          </>
        )}
      </div>
    </div>
  );
}
