"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { AppHeader } from "@/components/ui/AppHeader";
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
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold text-foreground">הנחיות ל־AI</h1>
          <p className="leading-relaxed text-muted">
            כאן מגדירים אילו רעיונות ה־AI יציע ואיזה סגנון כתיבה ישתמש. ההנחיות נשמרות ומשמשות
            בכל יצירת רעיונות, שלד, טיוטה והצעות עריכה.
          </p>
        </div>
        {loading ? (
          <p className="flex items-center gap-2 text-muted">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            טוען…
          </p>
        ) : (
          <div className="flex flex-col gap-8">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-foreground">
                אילו רעיונות להציע
              </label>
              <p className="text-xs text-muted">
                הנחיות לסוכן הרעיונות: נושאים (למשל טק, שיווק, מוטיבציה), קהל יעד, טון, כמה
                רעיונות, מגבלות. ה־AI יחזיר כותרות ותיאורים קצרים ב־JSON.
              </p>
              <textarea
                dir="rtl"
                value={ideasPrompt}
                onChange={(e) => setIdeasPrompt(e.target.value)}
                rows={8}
                className="min-h-[120px] w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-shadow"
                placeholder="למשל: הצע 3–7 רעיונות לניוזלטר בעברית. נושאים: פרודוקטיביות, קריירה, טכנולוגיה. טון מקצועי־ידידותי. ענה ב-JSON בלבד עם id, title, description."
              />
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-foreground">
                איזה סגנון לכתוב את הכתבות
              </label>
              <p className="text-xs text-muted">
                הנחיות לסגנון: טון (רשמי/קליל/מקצועי), אורך משפטים ופסקאות, מילים או ביטויים
                להעדיף או להימנע מהם. משמש לשלד, טיוטה והצעות עריכה.
              </p>
              <textarea
                dir="rtl"
                value={writingPrompt}
                onChange={(e) => setWritingPrompt(e.target.value)}
                rows={8}
                className="min-h-[120px] w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-shadow"
                placeholder="למשל: סגנון ברור, ממוקד, ידידותי. משפטים קצרים־בינוניים. צור שלד (פתיחה, גוף, סיום) וטיוטה בטקסט גולמי בלבד."
              />
            </div>
            <div className="space-y-4 border-t border-border pt-4">
              <h2 className="text-lg font-semibold text-foreground">רקע הדף</h2>
              <p className="text-xs text-muted">
                בחר רקע לכל האתר: ברירת מחדל, צבע, גרדיאנט או תמונה.
              </p>
              <div className="flex flex-wrap gap-4">
                {(["default", "color", "gradient", "image"] as const).map((t) => (
                  <label key={t} className="flex cursor-pointer items-center gap-2">
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
                      className="rounded-full border-border text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span className="text-sm text-foreground">
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
                    value={bgValue || "#f0fdf4"}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBgValue(v);
                      saveBackgroundPref({ type: "color", value: v });
                    }}
                    className="h-10 w-14 cursor-pointer rounded border border-border bg-background"
                  />
                  <input
                    type="text"
                    value={bgValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBgValue(v);
                      saveBackgroundPref({ type: "color", value: v });
                    }}
                    placeholder="#f0fdf4"
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
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
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
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
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              )}
            </div>
            {message && (
              <p
                className={
                  message.type === "ok"
                    ? "font-medium text-green-400"
                    : "font-medium text-red-400"
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
