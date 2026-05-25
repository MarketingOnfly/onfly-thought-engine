import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import type { LeaderProfile } from "@/lib/db/types";
import ProfileEditor from "./editor";

export default async function ProfilePage() {
  const user = (await getServerUser())!;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("leader_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="container max-w-3xl px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <h1 className="mt-4 font-display text-4xl tracking-tight">Seu perfil</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tudo aqui alimenta o motor. Mudou de área, audiência ou tom? Atualize aqui.
      </p>

      <ProfileEditor initial={data as LeaderProfile} />
    </div>
  );
}
