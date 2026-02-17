import { NextResponse } from "next/server";
import { validateOutline } from "./validate-outline";

/**
 * Factory for validate-outline / validate-draft route handlers.
 * Both do the same thing — validate text — with different maxClaims.
 */
export function createValidateHandler(maxClaims: number, errorLabel: string) {
  return async (request: Request) => {
    try {
      const body = await request.json();
      const { title, description } = body as {
        title?: string;
        description?: string;
      };
      // Support both "outline" and "draft" field names
      const text = (body as Record<string, unknown>).outline ?? (body as Record<string, unknown>).draft ?? "";
      if (!title) {
        return NextResponse.json(
          { error: "חסרה כותרת לרעיון" },
          { status: 400 }
        );
      }
      const result = await validateOutline(
        String(title),
        String(description ?? ""),
        String(text ?? ""),
        { maxClaims }
      );
      return NextResponse.json(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : errorLabel;
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
