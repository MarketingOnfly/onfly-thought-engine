import Link from "next/link";
import { ArrowLeft, Palette, User } from "lucide-react";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LeaderProfile } from "@/lib/db/types";
import PersonalProfileEditor from "./editor";
import StyleEditor from "../studio/editor";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = (await getServerUser())!;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("leader_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const params = await searchParams;
  const defaultTab = params.tab === "estilo" ? "estilo" : "pessoal";

  return (
    <div className="container max-w-4xl px-6 py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <h1 className="mt-4 font-display text-4xl tracking-tight">Seu perfil</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Sua identidade pública e a calibragem do motor — tudo num lugar só.
      </p>

      <Tabs defaultValue={defaultTab} className="mt-8">
        <TabsList>
          <TabsTrigger value="pessoal" className="gap-2">
            <User className="h-3.5 w-3.5" /> Pessoal
          </TabsTrigger>
          <TabsTrigger value="estilo" className="gap-2">
            <Palette className="h-3.5 w-3.5" /> Estilo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pessoal">
          <PersonalProfileEditor
            initial={data as LeaderProfile}
            userEmail={user.email ?? null}
          />
        </TabsContent>

        <TabsContent value="estilo">
          <StyleEditor initial={data as LeaderProfile} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
