"use client";

import { ButtonHTMLAttributes } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

const variants = {
  primary:
    "bg-[var(--accent)] text-white shadow-md hover:bg-[var(--accent-hover)] hover:shadow-lg active:scale-[0.98] px-6 py-3 text-base",
  secondary:
    "border-2 border-[var(--border-strong)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--background-subtle)] hover:border-[var(--accent)]/50 dark:border-[var(--border)] dark:hover:border-[var(--accent)]/50 px-6 py-3 text-base",
  ghost:
    "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-subtle)] px-4 py-2 text-sm",
};

export function PrimaryButton({
  children,
  disabled,
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
