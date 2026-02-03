"use client";

import { useSession } from "@/lib/state/session-context";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { RichEditor } from "@/components/editor/RichEditor";

export function EditingStage() {
  const { session, setEditedContent, goToStage } = useSession();
  const { draftContent, editedContent } = session;
  const content = editedContent || draftContent;

  return (
    <div className="flex flex-col gap-6 py-12 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        עריכה וליטוש
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        חידוד ניסוחים, קיצור או הארכה, שיפור בהירות. בלי ליצור תוכן חדש.
      </p>
      <div>
        <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
          הכתבה
        </label>
        <RichEditor
          value={content}
          onChange={setEditedContent}
          placeholder="ערוך כאן…"
        />
      </div>
      <PrimaryButton onClick={() => goToStage("completion")} className="self-end">
        הכתבה מוכנה
      </PrimaryButton>
    </div>
  );
}
