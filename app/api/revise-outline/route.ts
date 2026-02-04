import { NextResponse } from "next/server";
import {
  reviseOutlineFromValidation,
  type OutlineValidationItem,
  type OutlineValidationResult,
} from "@/lib/ai/validate-outline";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { outline, items, summary, allVerified, usedWebSearch } = body as {
      outline?: string;
      items?: OutlineValidationItem[];
      summary?: string;
      allVerified?: boolean;
      usedWebSearch?: boolean;
    };
    if (outline == null || outline === "") {
      return NextResponse.json(
        { error: "חסר שלד לעדכון" },
        { status: 400 }
      );
    }
    const validationResult: OutlineValidationResult = {
      items: Array.isArray(items) ? items : [],
      summary: typeof summary === "string" ? summary : "",
      allVerified: Boolean(allVerified),
      usedWebSearch: Boolean(usedWebSearch),
    };
    const revisedOutline = await reviseOutlineFromValidation(
      String(outline),
      validationResult
    );
    return NextResponse.json({ revisedOutline });
  } catch (e) {
    const message = e instanceof Error ? e.message : "שגיאה בעדכון השלד";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
