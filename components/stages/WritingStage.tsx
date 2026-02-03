"use client";

import { useSession } from "@/lib/state/session-context";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { RichEditor } from "@/components/editor/RichEditor";

export function WritingStage() {
  const { session, setDraftContent, setOutline, goToStage } = useSession();
  const { selectedIdea, outline, draftContent } = session;

  if (!selectedIdea) return null;

  return (
    <div className="flex flex-col gap-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        {selectedIdea.title}
      </h1>
      {outline && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 bg-zinc-50 dark:bg-zinc-900/50">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            שלד מוצע
          </h2>
          <pre className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300 font-sans text-sm">
            {outline}
          </pre>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
          הכתבה שלך
        </label>
        <RichEditor
          value={draftContent}
          onChange={setDraftContent}
          placeholder="כתוב כאן…"
        />
      </div>
      <PrimaryButton
        onClick={() => goToStage("editing")}
        className="self-end"
      >
        המשך לעריכה
      </PrimaryButton>
    </div>
  );
}
