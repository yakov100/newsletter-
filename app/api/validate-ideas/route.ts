import { NextResponse } from "next/server";
import { validateIdeas } from "@/lib/ai/validate-ideas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ideas } = body as { ideas?: Array<{ title?: string; description?: string }> };
    const list = Array.isArray(ideas)
      ? ideas
          .filter((i) => i && typeof i.title === "string")
          .map((i) => ({ title: i.title!, description: i.description }))
      : [];
    const results = await validateIdeas(list);
    return NextResponse.json({ results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה בבדיקת הרעיונות";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
