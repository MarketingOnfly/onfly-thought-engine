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
  // novos campos de seleção (migration 004)
  objectives: string[];
  preferred_formats: string[];
  content_types: string[];
  themes: string[];
  preferred_hook_styles: string[];
  audience_segments: string[];
  // perfil pessoal (migration 005)
  avatar_url: string | null;
  bio: string | null;
  twitter_url: string | null;
  website_url: string | null;
  timezone: string;
  notification_email: boolean;
  notification_digest: "never" | "daily" | "weekly";
  // preferências aprendidas a partir do feedback do líder (migration 012)
  learned_preferences: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentFeedback {
  id: string;
  user_id: string;
  content_draft_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  created_at: string;
}

export interface AltVersion {
  id: string;
  label: string; // ex: "Versão A (hook contrarian)"
  body: string;
  generated_at: string;
}

export interface StyleScore {
  overall: number; // 0-100
  matches: string[]; // bullets do que casou
  gaps: string[]; // bullets do que escapou
  computed_at: string;
}

export interface DraftVersion {
  id: string;
  content_draft_id: string;
  user_id: string;
  body: string;
  reason: string | null;
  created_at: string;
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  summary: string;
  published_at?: string | null;
}

export interface DailyNewsCache {
  user_id: string;
  items: NewsItem[];
  fetched_at: string;
}

export type ReferenceAnalysisStatus =
  | "pending"
  | "ok"
  | "unfetchable"
  | "analyzed_with_sample";

export interface ReferenceProfile {
  id: string;
  user_id: string;
  name: string;
  url: string;
  why_relevant: string | null;
  hook_examples: string | null;
  style_notes: string | null;
  tone_signals: string[];
  positioning: string | null;
  topics_recurring: string[];
  vocab_notes: string | null;
  analysis_error: string | null;
  analyzed_at: string | null;
  analysis_status: ReferenceAnalysisStatus;
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
  scheduled_at: string | null;
  tags: string[];
  alt_versions: AltVersion[];
  style_score: StyleScore | null;
  // publicação real no LinkedIn (migration 016)
  published_at: string | null;
  linkedin_post_urn: string | null;
  linkedin_post_url: string | null;
  publish_error: string | null;
  created_at: string;
  updated_at: string;
}

export type CampaignStatus =
  | "draft"
  | "queued"
  | "dispatching"
  | "sent"
  | "failed";

export type CampaignAudienceFilter =
  | { mode: "all" }
  | { mode: "specific_users"; user_ids: string[] }
  | { mode: "by_area"; areas: string[] }
  | { mode: "by_role"; roles: string[] };

export interface Campaign {
  id: string;
  name: string;
  theme: string;
  brief: string | null;
  format: ContentFormat;
  status: CampaignStatus;
  created_by: string | null;
  created_at: string;
  dispatched_at: string | null;
  notes: string | null;
  target_publish_date: string | null; // YYYY-MM-DD
  audience_filter: CampaignAudienceFilter;
}

export type CampaignDraftStatus =
  | "pending"
  | "generating"
  | "ready"
  | "failed"
  | "dismissed";

export interface CampaignDraft {
  id: string;
  campaign_id: string;
  user_id: string;
  draft_id: string | null;
  status: CampaignDraftStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export type VisualKind = "mindmap" | "infographic";

export interface ContentVisual {
  id: string;
  user_id: string;
  draft_id: string | null;
  kind: VisualKind;
  payload: string;
  prompt_used: string | null;
  created_at: string;
}

export type NotificationKind =
  | "campaign_ready"
  | "campaign_failed"
  | "admin_broadcast"
  | "release"
  | "best_practice"
  | "reminder"
  | "metric_alert";

export interface Notification {
  id: string;
  target_user_id: string | null;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  icon: string | null;
  created_by: string | null;
  created_at: string;
  read_at?: string | null; // computed client-side
}

export interface LinkedInConnection {
  user_id: string;
  linkedin_user_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string;
  scope: string | null;
  profile_data: Record<string, unknown>;
  linkedin_url: string | null;
  followers_count: number | null;
  last_synced_at: string | null;
  marketing_api_status: "not_requested" | "pending" | "approved" | "denied";
  created_at: string;
  updated_at: string;
}

export interface PostMetric {
  id: string;
  user_id: string;
  content_draft_id: string | null;
  linkedin_post_urn: string | null;
  linkedin_post_url: string | null;
  title: string | null;
  posted_at: string | null;
  impressions: number;
  unique_impressions: number | null;
  likes: number;
  comments: number;
  reposts: number;
  clicks: number;
  engagement_rate: number | null;
  source: "manual" | "csv" | "linkedin_api";
  fetched_at: string;
}

export interface CampaignAttachment {
  id: string;
  campaign_id: string;
  name: string;
  content: string;
  kind: "reference" | "data" | "press_release" | "brief" | "image";
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string | null;
  theme_template: string;
  brief_template: string | null;
  format: ContentFormat;
  category: string;
  is_active: boolean;
  created_at: string;
}

export interface LeaderOverview {
  user_id: string;
  full_name: string;
  role: string;
  area: string;
  target_audience: string;
  tone_traits: string[];
  main_objective: string;
  onboarding_completed: boolean;
  avatar_url: string | null;
  bio: string | null;
  joined_at: string;
  followers_count: number | null;
  linkedin_url: string | null;
  linkedin_synced_at: string | null;
  drafts_count: number;
  campaigns_received: number;
  total_impressions: number;
  posts_with_metrics: number;
  topics_covered: string[];
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
