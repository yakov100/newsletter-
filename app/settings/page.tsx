"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
  PAGE_BACKGROUND_STORAGE_KEY,
  PAGE_BACKGROUND_CHANGE_EVENT,
  GRADIENT_PRESETS,
  type PageBackgroundType,
  type PageBackgroundPref,
} from "@/lib/page-background";

function loadBackgroundPref(): PageBackgroundPref | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PAGE_BACKGROUND_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PageBackgroundPref;
    if (parsed?.type && ["default", "color", "gradient", "image"].includes(parsed.type)) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveBackgroundPref(pref: PageBackgroundPref) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PAGE_BACKGROUND_STORAGE_KEY, JSON.stringify(pref));
  window.dispatchEvent(new Event(PAGE_BACKGROUND_CHANGE_EVENT));
}

export default function SettingsPage() {
  const [ideasPrompt, setIdeasPrompt] = useState("");
  const [writingPrompt, setWritingPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [bgType, setBgType] = useState<PageBackgroundType>("default");
  const [bgValue, setBgValue] = useState("");

  useEffect(() => {
    const pref = loadBackgroundPref();
    if (pref) {
      setBgType(pref.type);
      setBgValue(pref.value || "");
    }
  }, []);

  useEffect(() => {
    fetch("/api/agent-config")
      .then((res) => res.json())
      .then((data) => {
        if (data.ideas?.systemPrompt) setIdeasPrompt(data.ideas.systemPrompt);
        if (data.writing?.systemPrompt) setWritingPrompt(data.writing.systemPrompt);
      })
      .catch(() => setMessage({ type: "err", text: "שגיאה בטעינת הגדרות" }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/agent-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideas: { systemPrompt: ideasPrompt },
          writing: { systemPrompt: writingPrompt },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMessage({ type: "ok", text: "ההגדרות נשמרו" });
    } catch (e) {
      setMessage({
        type: "err",
        text: e instanceof Error ? e.message : "שגיאה בשמירה",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-md">
        <Link href="/" className="text-xl font-bold gradient-text hover:opacity-90 transition-opacity">
          מערכת כתיבה חכמה
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--background-subtle)] px-3 py-2 rounded-lg transition-colors"
        >
          חזרה
        </Link>
      </header>
      <main className="flex-1 px-4 py-10 max-w-2xl mx-auto w-full">
        <div className="space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-[var(--foreground)]">
            הנחיות ל־AI
          </h1>
          <p className="text-[var(--foreground-muted)] leading-relaxed">
            כאן מגדירים אילו רעיונות ה־AI יציע ואיזה סגנון כתיבה ישתמש. ההנחיות נשמרות ומשמשות בכל יצירת רעיונות, שלד, טיוטה והצעות עריכה.
          </p>
        </div>
        {loading ? (
          <p className="text-[var(--foreground-muted)] flex items-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            טוען…
          </p>
        ) : (
          <div className="flex flex-col gap-8">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-[var(--foreground)]">
                אילו רעיונות להציע
              </label>
              <p className="text-xs text-[var(--foreground-muted)]">
                הנחיות לסוכן הרעיונות: נושאים (למשל טק, שיווק, מוטיבציה), קהל יעד, טון, כמה רעיונות, מגבלות. ה־AI יחזיר כותרות ותיאורים קצרים ב־JSON.
              </p>
              <textarea
                dir="rtl"
                value={ideasPrompt}
                onChange={(e) => setIdeasPrompt(e.target.value)}
                rows={8}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-y min-h-[120px] transition-shadow"
                placeholder="למשל: הצע 3–7 רעיונות לניוזלטר בעברית. נושאים: פרודוקטיביות, קריירה, טכנולוגיה. טון מקצועי־ידידותי. ענה ב-JSON בלבד עם id, title, description."
              />
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-[var(--foreground)]">
                איזה סגנון לכתוב את הכתבות
              </label>
              <p className="text-xs text-[var(--foreground-muted)]">
                הנחיות לסגנון: טון (רשמי/קליל/מקצועי), אורך משפטים ופסקאות, מילים או ביטויים להעדיף או להימנע מהם. משמש לשלד, טיוטה והצעות עריכה.
              </p>
              <textarea
                dir="rtl"
                value={writingPrompt}
                onChange={(e) => setWritingPrompt(e.target.value)}
                rows={8}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-y min-h-[120px] transition-shadow"
                placeholder="למשל: סגנון ברור, ממוקד, ידידותי. משפטים קצרים־בינוניים. צור שלד (פתיחה, גוף, סיום) וטיוטה בטקסט גולמי בלבד."
              />
            </div>
            <div className="space-y-4 pt-4 border-t border-[var(--border)]">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">רקע הדף</h2>
              <p className="text-xs text-[var(--foreground-muted)]">
                בחר רקע לכל האתר: ברירת מחדל, צבע, גרדיאנט או תמונה.
              </p>
              <div className="flex flex-wrap gap-4">
                {(["default", "color", "gradient", "image"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="bgType"
                      checked={bgType === t}
                      onChange={() => {
                        setBgType(t);
                        const val = t === "gradient" ? GRADIENT_PRESETS[0]?.id ?? "" : "";
                        setBgValue(val);
                        saveBackgroundPref({ type: t, value: val });
                      }}
                      className="rounded-full border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                    />
                    <span className="text-sm text-[var(--foreground)]">
                      {t === "default" && "ברירת מחדל"}
                      {t === "color" && "צבע"}
                      {t === "gradient" && "גרדיאנט"}
                      {t === "image" && "תמונה"}
                    </span>
                  </label>
                ))}
              </div>
              {bgType === "color" && (
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={bgValue || "#f8fafc"}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBgValue(v);
                      saveBackgroundPref({ type: "color", value: v });
                    }}
                    className="h-10 w-14 rounded border border-[var(--border)] cursor-pointer bg-[var(--card)]"
                  />
                  <input
                    type="text"
                    value={bgValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBgValue(v);
                      saveBackgroundPref({ type: "color", value: v });
                    }}
                    placeholder="#f8fafc"
                    className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
              )}
              {bgType === "gradient" && (
                <select
                  value={bgValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBgValue(v);
                    saveBackgroundPref({ type: "gradient", value: v });
                  }}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  {GRADIENT_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              )}
              {bgType === "image" && (
                <input
                  type="url"
                  value={bgValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBgValue(v);
                    saveBackgroundPref({ type: "image", value: v });
                  }}
                  placeholder="https://example.com/image.jpg"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              )}
            </div>
            {message && (
              <p
                className={
                  message.type === "ok"
                    ? "text-green-600 dark:text-green-400 font-medium"
                    : "text-red-600 dark:text-red-400 font-medium"
                }
                role="alert"
              >
                {message.text}
              </p>
            )}
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? "שומר…" : "שמור הגדרות"}
            </PrimaryButton>
          </div>
        )}
      </main>
    </div>
  );
}
