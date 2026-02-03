"use client";

import { useSession } from "@/lib/state/session-context";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export function CompletionStage() {
  const { session, resetSession } = useSession();
  const { selectedIdea, editedContent, draftContent } = session;
  const finalContent = editedContent || draftContent;

  const handleCopy = async () => {
    const plain = finalContent.replace(/<[^>]+>/g, "").trim();
    await navigator.clipboard.writeText(plain);
  };

  return (
    <div className="flex flex-col gap-8 py-12 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        סיום
      </h1>
      {selectedIdea && (
        <div>
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            כותרת
          </h2>
          <p className="text-lg text-zinc-900 dark:text-zinc-100">
            {selectedIdea.title}
          </p>
        </div>
      )}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 bg-zinc-50 dark:bg-zinc-900/50 max-h-64 overflow-y-auto">
        <div
          className="prose prose-zinc dark:prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{
            __html: finalContent || "<p>אין תוכן.</p>",
          }}
        />
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        <PrimaryButton onClick={handleCopy}>העתק clipboard</PrimaryButton>
        <PrimaryButton
          onClick={resetSession}
          className="bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
        >
          חזרה לרעיונות
        </PrimaryButton>
      </div>
    </div>
  );
}
