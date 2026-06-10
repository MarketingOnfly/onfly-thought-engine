import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  LeaderDocument,
  LeaderProfile,
  LeaderStory,
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
  // Histórias/números reais do líder — Story Bank (migration 019)
  stories: LeaderStory[];
}

export async function loadLeaderContext(
  userId: string
): Promise<LeaderContextBundle | null> {
  const supabase = await createSupabaseServerClient();

  const [
    profileRes,
    refProfilesRes,
    refLinksRes,
    docsRes,
    orgDocsRes,
    voiceRes,
    storiesRes,
  ] = await Promise.all([
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
      supabase
        .from("leader_stories")
        .select("*")
        .eq("user_id", userId)
        // Menos usadas primeiro — anti-repetição de história
        .order("times_used", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  if (profileRes.error || !profileRes.data) return null;

  return {
    leader: profileRes.data as LeaderProfile,
    referenceProfiles: (refProfilesRes.data ?? []) as ReferenceProfile[],
    referenceLinks: (refLinksRes.data ?? []) as ReferenceLink[],
    leaderDocuments: (docsRes.data ?? []) as LeaderDocument[],
    orgDocuments: (orgDocsRes.data ?? []) as OrgDocument[],
    // Se as migrations 018/019 ainda não rodaram, as queries falham
    // silenciosamente e os arrays ficam vazios — pipeline segue normal.
    voiceSamples: (voiceRes.data ?? []) as VoiceSample[],
    stories: (storiesRes.data ?? []) as LeaderStory[],
  };
}
