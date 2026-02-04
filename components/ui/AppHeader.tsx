"use client";

import Link from "next/link";
import { useRef, useCallback } from "react";
import type { Stage } from "@/types/session";

const NAV_ITEMS: { key: Stage; label: string }[] = [
  { key: "ideas", label: "רעיונות" },
  { key: "writing", label: "ראשי פרקים" },
  { key: "editing", label: "טיוטה" },
  { key: "completion", label: "סיום" },
];

function activeNavKey(stage: Stage): Stage {
  if (stage === "ideas" || stage === "select") return "ideas";
  return stage;
}

interface AppHeaderProps {
  currentStage?: Stage;
  onGoToStage?: (stage: Stage) => void;
}

export function AppHeader({ currentStage, onGoToStage }: AppHeaderProps) {
  const activeKey = currentStage ? activeNavKey(currentStage) : null;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (!onGoToStage) return;
      let nextIndex = index;
      // RTL: ArrowRight = previous (index+1), ArrowLeft = next (index-1)
      if (e.key === "ArrowRight" && index < NAV_ITEMS.length - 1) nextIndex = index + 1;
      else if (e.key === "ArrowLeft" && index > 0) nextIndex = index - 1;
      else if (e.key === "Home") nextIndex = 0;
      else if (e.key === "End") nextIndex = NAV_ITEMS.length - 1;
      else return;
      e.preventDefault();
      tabRefs.current[nextIndex]?.focus();
      onGoToStage(NAV_ITEMS[nextIndex].key);
    },
    [onGoToStage]
  );

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-border bg-background/80 px-6 py-4 backdrop-blur-md lg:px-40">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="flex size-8 items-center justify-center rounded-lg bg-[var(--primary)] text-white"
          aria-label="עוזר כתיבה AI"
          tabIndex={0}
        >
          <span className="material-symbols-outlined">auto_awesome</span>
        </Link>
        <Link href="/" className="text-lg font-bold leading-tight tracking-tight text-foreground" tabIndex={0}>
          עוזר כתיבה AI
        </Link>
      </div>
      <div className="hidden flex-1 justify-center md:flex">
        <nav
          className="flex items-center gap-8"
          aria-label="ניווט בין מסכים"
          role="tablist"
        >
          {NAV_ITEMS.map(({ key, label }, index) => {
            const isActive = activeKey === key;
            if (onGoToStage) {
              return (
                <button
                  key={key}
                  ref={(el) => { tabRefs.current[index] = el; }}
                  type="button"
                  role="tab"
                  tabIndex={0}
                  aria-selected={isActive}
                  aria-label={`מסך ${label}`}
                  onClick={() => onGoToStage(key)}
                  onKeyDown={(e) => handleTabKeyDown(e, index)}
                  className={`relative flex flex-col items-center text-sm font-medium leading-normal transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded ${
                    isActive ? "text-[var(--primary)] font-bold" : "text-muted hover:text-foreground"
                  }`}
                >
                  <span>{label}</span>
                  {isActive && (
                    <span className="absolute -bottom-[21px] h-[2px] w-full rounded-full bg-[var(--primary)]" />
                  )}
                </button>
              );
            }
            return (
              <Link
                key={key}
                href="/"
                role="tab"
                tabIndex={0}
                aria-selected={isActive}
                className={`relative flex flex-col items-center text-sm font-medium leading-normal transition-colors ${
                  isActive ? "text-[var(--primary)] font-bold" : "text-muted hover:text-foreground"
                }`}
              >
                <span>{label}</span>
                {isActive && (
                  <span className="absolute -bottom-[21px] h-[2px] w-full rounded-full bg-[var(--primary)]" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className="flex size-10 items-center justify-center overflow-hidden rounded-lg bg-card text-foreground transition-all hover:bg-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          aria-label="הגדרות"
          tabIndex={0}
        >
          <span className="material-symbols-outlined">settings</span>
        </Link>
        <Link
          href="/auth"
          className="flex size-10 items-center justify-center overflow-hidden rounded-lg bg-card text-foreground transition-all hover:bg-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          aria-label="חשבון"
          tabIndex={0}
        >
          <span className="material-symbols-outlined">account_circle</span>
        </Link>
      </div>
    </header>
  );
}
