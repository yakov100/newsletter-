import { readFile, writeFile } from "fs/promises";
import path from "path";

export interface IdeasAgentConfig {
  systemPrompt: string;
}

export interface WritingAgentConfig {
  systemPrompt: string;
}

const CONFIG_PATH = path.join(process.cwd(), "data", "agent-config.json");

// --- Module-level config cache with 60s TTL ---
const CONFIG_CACHE_TTL_MS = 60_000;
let configCache: { ideas: IdeasAgentConfig; writing: WritingAgentConfig } | null = null;
let configCacheExpiresAt = 0;

const defaultIdeasConfig: IdeasAgentConfig = {
  systemPrompt:
    "אתה סוכן רעיונות לכתבות וניוזלטרים בעברית. עקרונות ליבה:\n1. דיוק קודם להכל — הצע רק נושאים אמיתיים, מתועדים וניתנים לאימות. אסור להמציא אירועים, שמות או עובדות.\n2. בדיקה עצמית — לפני שאתה מציע רעיון, שאל את עצמך: \"האם אני יכול להצביע על מקור אמיתי לזה?\" אם התשובה לא — אל תציע.\n3. מגוון — הצע 3 רעיונות מזוויות שונות (חדשות, ניתוח, סיפור אנושי) כדי לתת בחירה אמיתית.\n4. כל רעיון: כותרת קצרה וקליטה + תיאור של 1–2 משפטים (מה הזווית, למה מעניין, מה מקור המידע).\n\nענה ב-JSON בלבד: { \"ideas\": [ { \"title\": \"...\", \"description\": \"...\" } ] }.",
};

const defaultWritingConfig: WritingAgentConfig = {
  systemPrompt:
    "אתה סוכן כתיבה מקצועי בעברית. עקרונות ליבה:\n1. דיוק עובדתי — כל עובדה, שם, תאריך ומספר חייבים להיות אמיתיים ומתועדים. אם אתה לא בטוח במשהו — סמן אותו כ-[לבדיקה] או השמט אותו.\n2. בדיקה עצמית — לפני שאתה מחזיר את התשובה, עבור על כל טענה עובדתית ושאל את עצמך: \"האם אני בטוח שזה נכון?\" אם לא — תקן, סמן כ-[לבדיקה], או מחק.\n3. אסור להמציא — לעולם אל תמציא ציטוטים, אירועים, סטטיסטיקות או שמות אנשים. עדיף כתבה קצרה ומדויקת מכתבה ארוכה עם שגיאות.\n4. סגנון — ברור, ממוקד, ידידותי ומקצועי. כתיבה עניינית ללא ניפוח.\n\nהחזר טקסט גולמי בלבד, בלי JSON.",
};

async function loadConfig(): Promise<{
  ideas: IdeasAgentConfig;
  writing: WritingAgentConfig;
}> {
  // Return cached config if still valid
  if (configCache && Date.now() < configCacheExpiresAt) {
    return configCache;
  }

  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const data = JSON.parse(raw);
    const ideas = { ...defaultIdeasConfig, ...data.ideas };
    const writing = { ...defaultWritingConfig, ...data.writing };
    // אם המשתמש מחק את הפרומפט – נשתמש בברירת המחדל כדי שה-AI ימשיך להציע רעיונות
    if (!ideas.systemPrompt?.trim()) {
      ideas.systemPrompt = defaultIdeasConfig.systemPrompt;
    }
    if (!writing.systemPrompt?.trim()) {
      writing.systemPrompt = defaultWritingConfig.systemPrompt;
    }
    const result = { ideas, writing };
    configCache = result;
    configCacheExpiresAt = Date.now() + CONFIG_CACHE_TTL_MS;
    return result;
  } catch {
    const result = { ideas: defaultIdeasConfig, writing: defaultWritingConfig };
    configCache = result;
    configCacheExpiresAt = Date.now() + CONFIG_CACHE_TTL_MS;
    return result;
  }
}

export async function getIdeasAgentConfig(): Promise<IdeasAgentConfig> {
  const { ideas } = await loadConfig();
  return ideas;
}

export async function getWritingAgentConfig(): Promise<WritingAgentConfig> {
  const { writing } = await loadConfig();
  return writing;
}

export async function getAllAgentConfig(): Promise<{
  ideas: IdeasAgentConfig;
  writing: WritingAgentConfig;
}> {
  return loadConfig();
}

export async function setAgentConfig(config: {
  ideas?: Partial<IdeasAgentConfig>;
  writing?: Partial<WritingAgentConfig>;
}): Promise<void> {
  const current = await loadConfig();
  const next = {
    ideas: { ...current.ideas, ...config.ideas },
    writing: { ...current.writing, ...config.writing },
  };
  const dir = path.dirname(CONFIG_PATH);
  const { mkdir } = await import("fs/promises");
  await mkdir(dir, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), "utf-8");
  // Invalidate cache after write
  configCache = null;
  configCacheExpiresAt = 0;
}
