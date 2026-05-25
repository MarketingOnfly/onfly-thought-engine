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

  const { data, error } = await supabase
    .from("content_drafts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) notFound();

  return (
    <div className="container max-w-4xl px-6 py-10">
      <Link
        href="/dashboard/library"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Biblioteca
      </Link>

      <ContentEditor initial={data as ContentDraft} />
    </div>
  );
}
