import { NextResponse } from "next/server";
import { getWritingAgentConfig } from "@/lib/agent-config";
import { generateDraft, generateAllDrafts } from "@/lib/ai/draft";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, outline, generateAll } = body as {
      title?: string;
      description?: string;
      outline?: string;
      generateAll?: boolean;
    };
    if (!title) {
      return NextResponse.json(
        { error: "חסרה כותרת לרעיון" },
        { status: 400 }
      );
    }
    const config = await getWritingAgentConfig();
    const t = String(title);
    const d = String(description ?? "");
    const o = String(outline ?? "");

    if (generateAll) {
      const result = await generateAllDrafts(config, t, d, o);
      return NextResponse.json(result);
    }

    const draft = await generateDraft(config, t, d, o);
    return NextResponse.json({ draft });
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה ביצירת טיוטה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
