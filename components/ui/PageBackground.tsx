"use client";

import { useEffect, useState } from "react";
import {
  PAGE_BACKGROUND_STORAGE_KEY,
  PAGE_BACKGROUND_CHANGE_EVENT,
  getBackgroundStyle,
  type PageBackgroundPref,
} from "@/lib/page-background";

function loadPref(): PageBackgroundPref | null {
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

export function PageBackground() {
  const [pref, setPref] = useState<PageBackgroundPref | null>(null);

  useEffect(() => {
    setPref(loadPref());
    const onChange = () => setPref(loadPref());
    window.addEventListener(PAGE_BACKGROUND_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(PAGE_BACKGROUND_CHANGE_EVENT, onChange);
  }, []);

  const style = getBackgroundStyle(pref);
  if (!style) return null;

  return (
    <div
      className="fixed inset-0 -z-10"
      style={style}
      aria-hidden
    />
  );
}
