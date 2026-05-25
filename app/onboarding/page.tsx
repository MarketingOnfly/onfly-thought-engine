import { redirect } from "next/navigation";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import OnboardingWizard from "./wizard";

export default async function OnboardingPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("leader_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed) {
    redirect("/dashboard");
  }

  return <OnboardingWizard initialProfile={profile} userEmail={user.email ?? null} />;
}
