import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import type { ContentDraft } from "@/lib/db/types";
import CalendarView from "./view";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = (await getServerUser())!;
  const supabase = await createSupabaseServerClient();

  const { month } = await searchParams;
  const today = new Date();
  // month: "YYYY-MM" format
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    viewYear = y;
    viewMonth = m - 1;
  }

  const start = new Date(viewYear, viewMonth, 1);
  const end = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59);

  const { data: scheduledData } = await supabase
    .from("content_drafts")
    .select("*")
    .eq("user_id", user.id)
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", start.toISOString())
    .lte("scheduled_at", end.toISOString())
    .order("scheduled_at", { ascending: true });

  const { data: unscheduledData } = await supabase
    .from("content_drafts")
    .select("*")
    .eq("user_id", user.id)
    .is("scheduled_at", null)
    .neq("status", "approved")
    .order("updated_at", { ascending: false })
    .limit(20);

  return (
    <div className="container max-w-6xl px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>
      <CalendarView
        year={viewYear}
        month={viewMonth}
        scheduled={(scheduledData ?? []) as ContentDraft[]}
        unscheduled={(unscheduledData ?? []) as ContentDraft[]}
      />
    </div>
  );
}
