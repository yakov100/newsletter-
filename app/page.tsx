"use client";

import { SessionProvider, useSession } from "@/lib/state/session-context";
import type { Stage } from "@/types/session";
import { IdeasStage } from "@/components/stages/IdeasStage";
import { SelectIdeaStage } from "@/components/stages/SelectIdeaStage";
import { WritingStage } from "@/components/stages/WritingStage";
import { EditingStage } from "@/components/stages/EditingStage";
import { CompletionStage } from "@/components/stages/CompletionStage";
import { AppHeader } from "@/components/ui/AppHeader";

function MainContent() {
  const { session, goToStage } = useSession();
  const { stage } = session;

  return (
    <>
      <AppHeader currentStage={stage} onGoToStage={goToStage} />
      <main className="flex flex-1 flex-col min-h-0">
        {stage === "editing" ? (
          <div className="flex flex-1 flex-col min-h-0">
            <EditingStage />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-40">
            <div className="w-full max-w-4xl">
              {stage === "ideas" && <IdeasStage />}
              {stage === "select" && <SelectIdeaStage />}
              {stage === "writing" && <WritingStage />}
              {stage === "completion" && <CompletionStage />}
            </div>
          </div>
        )}
      </main>
      <footer className="p-10 text-center text-xs text-white/30">
        © 2024 עוזר כתיבה AI — כל הזכויות שמורות
      </footer>
    </>
  );
}

export default function Home() {
  return (
    <SessionProvider>
      <div className="flex min-h-screen flex-col">
        <MainContent />
      </div>
    </SessionProvider>
  );
}
