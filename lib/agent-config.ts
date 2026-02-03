import { readFile, writeFile } from "fs/promises";
import path from "path";

export interface IdeasAgentConfig {
  systemPrompt: string;
}

export interface WritingAgentConfig {
  systemPrompt: string;
}

const CONFIG_PATH = path.join(process.cwd(), "data", "agent-config.json");

const defaultIdeasConfig: IdeasAgentConfig = {
  systemPrompt:
    "אתה סוכן רעיונות לכתבות וניוזלטרים. הצע בדיוק 3 רעיונות. כל רעיון: כותרת קצרה ותיאור של 1–2 משפטים (מה הזווית, למה מעניין). ענה ב-JSON בלבד: { \"ideas\": [ { \"id\": \"uuid\", \"title\": \"...\", \"description\": \"...\" } ] }.",
};

const defaultWritingConfig: WritingAgentConfig = {
  systemPrompt:
    "אתה סוכן כתיבה. סגנון: ברור, ממוקד, ידידותי. צור שלד לכתבה (פתיחה, גוף, סיום) לפי הרעיון שניתן. החזר טקסט גולמי בלבד, בלי JSON.",
};

async function loadConfig(): Promise<{
  ideas: IdeasAgentConfig;
  writing: WritingAgentConfig;
}> {
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
    return { ideas, writing };
  } catch {
    return { ideas: defaultIdeasConfig, writing: defaultWritingConfig };
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
}
