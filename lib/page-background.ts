export type PageBackgroundType = "default" | "color" | "gradient" | "image";

export interface PageBackgroundPref {
  type: PageBackgroundType;
  value: string;
}

export const PAGE_BACKGROUND_STORAGE_KEY = "app-page-background";
export const PAGE_BACKGROUND_CHANGE_EVENT = "page-background-change";

export const GRADIENT_PRESETS: { id: string; label: string; css: string }[] = [
  { id: "teal", label: "טורקיז", css: "linear-gradient(135deg, #0d9488 0%, #0891b2 50%, #0e7490 100%)" },
  { id: "sunset", label: "שקיעה", css: "linear-gradient(135deg, #f97316 0%, #ea580c 50%, #dc2626 100%)" },
  { id: "ocean", label: "אוקיינוס", css: "linear-gradient(180deg, #0c4a6e 0%, #0369a1 50%, #0ea5e9 100%)" },
  { id: "lavender", label: "לבנדר", css: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 50%, #c4b5fd 100%)" },
  { id: "forest", label: "יער", css: "linear-gradient(180deg, #14532d 0%, #166534 50%, #22c55e 100%)" },
  { id: "soft", label: "רך (אפור-תכלת)", css: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 50%, #cbd5e1 100%)" },
];

export function getBackgroundStyle(pref: PageBackgroundPref | null): Record<string, string> | undefined {
  if (!pref || pref.type === "default") return undefined;
  if (pref.type === "color" && pref.value) {
    return { background: pref.value };
  }
  if (pref.type === "gradient" && pref.value) {
    const preset = GRADIENT_PRESETS.find((p) => p.id === pref.value);
    if (preset) return { background: preset.css };
  }
  if (pref.type === "image" && pref.value) {
    return {
      backgroundImage: `url(${pref.value})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }
  return undefined;
}
