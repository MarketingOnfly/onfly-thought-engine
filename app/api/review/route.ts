import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/supabase/server";
import { reviewText } from "@/lib/anthropic/review";
import { z } from "zod";

export const maxDuration = 30;

const schema = z.object({
  text: z.string().min(40),
  format: z.enum(["linkedin_post", "article"]),
});

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 422 });
  }

  try {
    const result = await reviewText({
      userId: user.id,
      text: parsed.data.text,
      format: parsed.data.format,
    });
    if (!result) {
      return NextResponse.json(
        { error: "texto curto demais ou perfil incompleto" },
        { status: 412 }
      );
    }
    return NextResponse.json({ review: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "review_failed" },
      { status: 500 }
    );
  }
}
