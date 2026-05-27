import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import type { ContentDraft } from "@/lib/db/types";
import ContentEditor from "./editor";

export default async function ContentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = (await getServerUser())!;
  const supabase = await createSupabaseServerClient();
  const { id } = await params;

  const [{ data, error }, { data: profile }, { data: conn }] =
    await Promise.all([
      supabase
        .from("content_drafts")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("leader_profiles")
        .select("full_name, role, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("linkedin_connections")
        .select("linkedin_user_id, token_expires_at")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  if (error || !data) notFound();

  const linkedinReady =
    !!conn &&
    !!conn.token_expires_at &&
    new Date(conn.token_expires_at) > new Date();

  return (
    <div className="container max-w-5xl px-6 py-10">
      <Link
        href="/dashboard/library"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Biblioteca
      </Link>

      <ContentEditor
        initial={data as ContentDraft}
        authorName={(profile?.full_name as string) ?? "Você"}
        authorRole={(profile?.role as string | null) ?? null}
        authorAvatar={(profile?.avatar_url as string | null) ?? null}
        linkedinReady={linkedinReady}
      />
    </div>
  );
}
