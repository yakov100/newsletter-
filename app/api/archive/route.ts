import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "ארכיון לא מוגדר. הגדר Supabase בסביבה." },
      { status: 503 }
    );
  }
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: "יש להתחבר כדי לשמור לארכיון" },
      { status: 401 }
    );
  }
  const body = await request.json();
  const { title, content } = body as { title?: string; content?: string };
  if (!title || typeof content !== "string") {
    return NextResponse.json(
      { error: "חסרים כותרת או תוכן" },
      { status: 400 }
    );
  }
  const { data, error } = await supabase
    .from("archive")
    .insert({ user_id: user.id, title, content })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json(
      { error: error.message || "שגיאה בשמירה לארכיון" },
      { status: 500 }
    );
  }
  return NextResponse.json({ id: data.id, ok: true });
}

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ items: [] });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ items: [] });
  }
  const { data } = await supabase
    .from("archive")
    .select("id, title, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ items: data ?? [] });
}
