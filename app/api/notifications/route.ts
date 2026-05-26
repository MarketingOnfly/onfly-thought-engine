import { NextResponse } from "next/server";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import type { Notification } from "@/lib/db/types";

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServerClient();

  // Pega broadcasts + diretas
  const { data: notifsData } = await supabase
    .from("notifications")
    .select("*")
    .or(`target_user_id.is.null,target_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(50);

  const notifs = (notifsData ?? []) as Notification[];
  const ids = notifs.map((n) => n.id);

  // Quais já foram lidas
  let readMap: Record<string, string> = {};
  if (ids.length) {
    const { data: readsData } = await supabase
      .from("notification_reads")
      .select("notification_id,read_at")
      .eq("user_id", user.id)
      .in("notification_id", ids);

    readMap = Object.fromEntries(
      (readsData ?? []).map((r) => [r.notification_id, r.read_at])
    );
  }

  const merged = notifs.map((n) => ({
    ...n,
    read_at: readMap[n.id] ?? null,
  }));

  const unread = merged.filter((n) => !n.read_at).length;

  return NextResponse.json({ items: merged, unread });
}
