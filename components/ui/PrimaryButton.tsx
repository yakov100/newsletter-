"use client";

import { ButtonHTMLAttributes } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-bold transition-all duration-200 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none h-12 px-6 text-base";

const variants = {
  primary:
    "bg-[var(--primary)] text-white hover:opacity-90 active:scale-95",
  secondary:
    "bg-card text-foreground border border-border hover:bg-card-hover hover:border-[var(--border-strong)] active:scale-95",
  ghost:
    "text-muted hover:text-foreground hover:bg-card px-4 py-2 h-auto text-sm",
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
