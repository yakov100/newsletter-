import { NextResponse } from "next/server";
import { validateOutline } from "@/lib/ai/validate-outline";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, outline } = body as {
      title?: string;
      description?: string;
      outline?: string;
    };
    if (!title) {
      return NextResponse.json(
        { error: "חסרה כותרת לרעיון" },
        { status: 400 }
      );
    }
    const result = await validateOutline(
      String(title),
      String(description ?? ""),
      String(outline ?? "")
    );
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה באימות השלד";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
