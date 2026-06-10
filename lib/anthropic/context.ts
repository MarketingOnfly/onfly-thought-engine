import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  LeaderDocument,
  LeaderProfile,
  OrgDocument,
  ReferenceLink,
  ReferenceProfile,
  VoiceSample,
} from "@/lib/db/types";

export interface LeaderContextBundle {
  leader: LeaderProfile;
  referenceProfiles: ReferenceProfile[];
  referenceLinks: ReferenceLink[];
  leaderDocuments: LeaderDocument[];
  orgDocuments: OrgDocument[];
  // Textos escritos PELO líder — fonte soberana do tom (migration 018)
  voiceSamples: VoiceSample[];
}

export async function loadLeaderContext(
  userId: string
): Promise<LeaderContextBundle | null> {
  const supabase = await createSupabaseServerClient();

  const [profileRes, refProfilesRes, refLinksRes, docsRes, orgDocsRes, voiceRes] =
    await Promise.all([
      supabase
        .from("leader_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("reference_profiles")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("reference_links")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("leader_documents")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      supabase
        .from("org_documents")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("leader_voice_samples")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  if (profileRes.error || !profileRes.data) return null;

  return {
    leader: profileRes.data as LeaderProfile,
    referenceProfiles: (refProfilesRes.data ?? []) as ReferenceProfile[],
    referenceLinks: (refLinksRes.data ?? []) as ReferenceLink[],
    leaderDocuments: (docsRes.data ?? []) as LeaderDocument[],
    orgDocuments: (orgDocsRes.data ?? []) as OrgDocument[],
    // Se a migration 018 ainda não rodou, a query falha silenciosamente
    // e voiceSamples fica vazio — pipeline segue com tone_examples.
    voiceSamples: (voiceRes.data ?? []) as VoiceSample[],
  };
}
