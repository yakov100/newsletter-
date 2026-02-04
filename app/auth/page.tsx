"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { AppHeader } from "@/components/ui/AppHeader";

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
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <p className="max-w-sm text-center text-muted">
          התחברות לא מוגדרת. הגדר NEXT_PUBLIC_SUPABASE_URL ו-NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </p>
        <Link href="/" className="mt-6 font-semibold text-[var(--primary)] hover:underline">
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
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold text-foreground">
              {isSignUp ? "הרשמה" : "התחברות"}
            </h1>
            <p className="text-sm text-muted">
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
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-shadow"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="סיסמה"
              required
              minLength={6}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-shadow"
            />
            {message && (
              <p
                className={
                  message.type === "ok"
                    ? "text-sm font-medium text-green-400"
                    : "text-sm font-medium text-red-400"
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
            className="text-center text-sm font-medium text-[var(--primary)] hover:underline"
          >
            {isSignUp ? "כבר יש חשבון? התחבר" : "אין חשבון? הירשם"}
          </button>
        </div>
      </main>
    </div>
  );
}
