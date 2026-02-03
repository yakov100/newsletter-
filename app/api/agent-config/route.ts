import { NextResponse } from "next/server";
import {
  getAllAgentConfig,
  setAgentConfig,
  type IdeasAgentConfig,
  type WritingAgentConfig,
} from "@/lib/agent-config";

export async function GET() {
  try {
    const config = await getAllAgentConfig();
    return NextResponse.json(config);
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה בטעינת הגדרות";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      ideas,
      writing,
    }: {
      ideas?: Partial<IdeasAgentConfig>;
      writing?: Partial<WritingAgentConfig>;
    } = body;
    await setAgentConfig({ ideas, writing });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה בשמירת הגדרות";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
