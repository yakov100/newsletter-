"use client";

import { useSession } from "@/lib/state/session-context";

interface StepDef {
  label: string;
  key: "idea" | "outline" | "draft";
}

const STEPS: StepDef[] = [
  { label: "רעיון", key: "idea" },
  { label: "שלד", key: "outline" },
  { label: "טיוטה", key: "draft" },
];

export function ValidationProgressBar() {
  const { session } = useSession();

  const status = (key: StepDef["key"]): "verified" | "unverified" | "pending" => {
    if (key === "idea") {
      if (!session.ideaValidation) return "pending";
      return session.ideaValidation.every((v) => v.valid) ? "verified" : "unverified";
    }
    if (key === "outline") {
      if (!session.outlineValidation) return "pending";
      return session.outlineValidation.allVerified ? "verified" : "unverified";
    }
    if (key === "draft") {
      if (!session.draftValidation) return "pending";
      return session.draftValidation.allVerified ? "verified" : "unverified";
    }
    return "pending";
  };

  const hasAnyValidation =
    session.ideaValidation || session.outlineValidation || session.draftValidation;

  if (!hasAnyValidation) return null;

  return (
    <div className="flex items-center justify-center gap-4 rounded-xl border border-border bg-card px-4 py-2 text-xs" dir="rtl">
      <span className="font-bold text-muted">אימות:</span>
      {STEPS.map((step) => {
        const s = status(step.key);
        return (
          <span key={step.key} className="flex items-center gap-1">
            {s === "verified" ? (
              <span className="material-symbols-outlined text-sm text-emerald-500">check_circle</span>
            ) : s === "unverified" ? (
              <span className="material-symbols-outlined text-sm text-amber-500">warning</span>
            ) : (
              <span className="material-symbols-outlined text-sm text-slate-400">radio_button_unchecked</span>
            )}
            <span className={s === "verified" ? "text-emerald-600 dark:text-emerald-400" : s === "unverified" ? "text-amber-600 dark:text-amber-400" : "text-muted"}>
              {step.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}
