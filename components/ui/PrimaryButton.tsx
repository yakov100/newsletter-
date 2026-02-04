"use client";

import { ButtonHTMLAttributes } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-bold transition-all duration-200 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none h-12 px-6 text-base";

const variants = {
  primary:
    "bg-[var(--primary)] text-white hover:opacity-90 active:scale-95",
  secondary:
    "bg-white/10 text-white border border-white/10 hover:bg-white/20 hover:border-white/20 active:scale-95",
  ghost:
    "text-white/60 hover:text-white hover:bg-white/10 px-4 py-2 h-auto text-sm",
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
