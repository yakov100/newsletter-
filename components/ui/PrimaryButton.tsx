"use client";

import { ButtonHTMLAttributes } from "react";

export function PrimaryButton({
  children,
  disabled,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={
        "rounded-xl bg-zinc-900 px-8 py-4 text-lg font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}
