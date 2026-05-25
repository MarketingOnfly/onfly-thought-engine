export type ReferenceLinkKind =
  | "substack"
  | "newsletter"
  | "blog"
  | "portal"
  | "podcast"
  | "youtube"
  | "other";

export type ContentFormat = "linkedin_post" | "article";
export type ContentStatus = "draft" | "refining" | "approved";
export type TopicStatus = "new" | "saved" | "dismissed";

export interface LeaderProfile {
  user_id: string;
  full_name: string;
  role: string;
  area: string;
  linkedin_url: string | null;
  target_audience: string;
  tone_traits: string[];
  tone_avoid: string[];
  tone_examples: string | null;
  main_objective: string;
  custom_briefing: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReferenceProfile {
  id: string;
  user_id: string;
  name: string;
  url: string;
  why_relevant: string | null;
  hook_examples: string | null;
  created_at: string;
}

export interface ReferenceLink {
  id: string;
  user_id: string;
  url: string;
  title: string;
  kind: ReferenceLinkKind;
  notes: string | null;
  created_at: string;
}

export interface LeaderDocument {
  id: string;
  user_id: string;
  name: string;
  content: string;
  kind: string;
  created_at: string;
}

export interface OrgDocument {
  id: string;
  name: string;
  content: string;
  kind: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ContentDraft {
  id: string;
  user_id: string;
  format: ContentFormat;
  topic: string;
  brief: string | null;
  draft_markdown: string | null;
  final_markdown: string | null;
  status: ContentStatus;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TopicSuggestion {
  id: string;
  user_id: string;
  source_url: string | null;
  source_title: string | null;
  title: string;
  angle: string;
  why_now: string | null;
  relevance_score: number;
  status: TopicStatus;
  created_at: string;
}
