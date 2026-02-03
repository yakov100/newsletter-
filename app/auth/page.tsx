"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  if (!supabase) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--background)]">
        <p className="text-[var(--foreground-muted)] text-center max-w-sm">
          התחברות לא מוגדרת. הגדר NEXT_PUBLIC_SUPABASE_URL ו-NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </p>
        <Link
          href="/"
          className="mt-6 text-[var(--accent)] font-semibold hover:underline"
        >
          חזרה
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage({ type: "ok", text: "נרשמת. בדוק את המייל לאימות." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      setMessage({ type: "err", text: err.message ?? "שגיאה" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <header className="px-4 sm:px-6 py-4 border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-md">
        <Link href="/" className="text-xl font-bold gradient-text hover:opacity-90 transition-opacity">
          מערכת כתיבה חכמה
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm flex flex-col gap-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-[var(--foreground)]">
              {isSignUp ? "הרשמה" : "התחברות"}
            </h1>
            <p className="text-[var(--foreground-muted)] text-sm">
              {isSignUp ? "צור חשבון חדש" : "התחבר כדי לשמור לארכיון"}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="אימייל"
              required
              dir="ltr"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-shadow"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="סיסמה"
              required
              minLength={6}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-shadow"
            />
            {message && (
              <p
                className={
                  message.type === "ok"
                    ? "text-green-600 dark:text-green-400 text-sm font-medium"
                    : "text-red-600 dark:text-red-400 text-sm font-medium"
                }
                role="alert"
              >
                {message.text}
              </p>
            )}
            <PrimaryButton type="submit" disabled={loading} className="w-full">
              {loading ? "…" : isSignUp ? "הרשמה" : "התחבר"}
            </PrimaryButton>
          </form>
          <button
            type="button"
            onClick={() => setIsSignUp((v) => !v)}
            className="text-sm text-[var(--accent)] font-medium hover:underline text-center"
          >
            {isSignUp ? "כבר יש חשבון? התחבר" : "אין חשבון? הירשם"}
          </button>
        </div>
      </main>
    </div>
  );
}
