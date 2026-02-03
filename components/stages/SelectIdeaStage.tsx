"use client";

import { useSession } from "@/lib/state/session-context";
import type { Idea } from "@/types/idea";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

function IdeaCard({
  idea,
  selected,
  onSelect,
}: {
  idea: Idea;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        "w-full text-right rounded-xl border-2 p-5 transition " +
        (selected
          ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600")
      }
    >
      <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        {idea.title}
      </h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {idea.description}
      </p>
    </button>
  );
}

export function SelectIdeaStage() {
  const { session, selectIdea, goToStage } = useSession();
  const { ideas, selectedIdea } = session;

  const handleContinue = () => {
    if (selectedIdea) goToStage("writing");
  };

  return (
    <div className="flex flex-col gap-8 py-12 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        בחר רעיון אחד
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        לחץ על הרעיון שבו תרצה להמשיך. רק אחד – כדי שלא להתפזר.
      </p>
      <div className="flex flex-col gap-3">
        {ideas.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            selected={selectedIdea?.id === idea.id}
            onSelect={() => selectIdea(idea)}
          />
        ))}
      </div>
      <PrimaryButton
        onClick={handleContinue}
        disabled={!selectedIdea}
        className="self-center"
      >
        ממש לכתיבה
      </PrimaryButton>
    </div>
  );
}
