import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import CreateForm from "./form";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; angle?: string; format?: string }>;
}) {
  const user = (await getServerUser())!;
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("leader_profiles")
    .select("full_name, objectives, preferred_hook_styles, content_types, tone_traits")
    .eq("user_id", user.id)
    .single();

  const params = await searchParams;

  return (
    <div className="container max-w-4xl px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <h1 className="mt-4 font-display text-4xl tracking-tight">Criar conteúdo</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tema + opções rápidas. O motor entrega o draft na sua voz.
      </p>

      <CreateForm
        leaderName={profile?.full_name ?? "líder"}
        prefillTopic={params.topic}
        prefillBrief={params.angle}
        prefillFormat={
          params.format === "article" ? "article" : "linkedin_post"
        }
        defaultObjective={profile?.objectives?.[0] ?? null}
        defaultHookStyle={profile?.preferred_hook_styles?.[0] ?? null}
        defaultContentType={profile?.content_types?.[0] ?? null}
        defaultTone={profile?.tone_traits ?? []}
      />
    </div>
  );
}
