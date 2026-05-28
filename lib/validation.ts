import { z } from "zod";

export const profileSchema = z.object({
  full_name: z.string().min(2, "Diz seu nome completo"),
  role: z.string().min(2, "Cargo é obrigatório"),
  area: z.string().min(2, "Área é obrigatória"),
  linkedin_url: z
    .string()
    .url("URL inválida")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : (v ?? null))),
  // audiência: ao menos 1 segmento OU texto livre
  target_audience: z.string().default(""),
  audience_segments: z.array(z.string()).default([]),
  // tom
  tone_traits: z.array(z.string()).min(1, "Escolhe ao menos 1 traço"),
  tone_avoid: z.array(z.string()).default([]),
  tone_examples: z.string().optional().nullable(),
  // objetivos + estilo
  objectives: z.array(z.string()).default([]),
  preferred_formats: z.array(z.string()).default([]),
  content_types: z.array(z.string()).default([]),
  themes: z.array(z.string()).default([]),
  preferred_hook_styles: z.array(z.string()).default([]),
  // legacy fields ainda aceitos pra retrocompat
  main_objective: z.string().default(""),
  custom_briefing: z.string().optional().nullable(),
});

/**
 * Patch parcial de estilo — sem campos de identidade (que vivem em /api/profile/personal).
 * Tudo é opcional aqui pra permitir updates parciais a partir do StyleEditor.
 */
export const profileStyleSchema = z.object({
  target_audience: z.string().optional(),
  audience_segments: z.array(z.string()).optional(),
  tone_traits: z.array(z.string()).min(1, "Escolhe ao menos 1 traço").optional(),
  tone_avoid: z.array(z.string()).optional(),
  tone_examples: z.string().optional().nullable(),
  objectives: z.array(z.string()).optional(),
  preferred_formats: z.array(z.string()).optional(),
  content_types: z.array(z.string()).optional(),
  themes: z.array(z.string()).optional(),
  preferred_hook_styles: z.array(z.string()).optional(),
  main_objective: z.string().optional(),
  custom_briefing: z.string().optional().nullable(),
});

export const referenceProfileSchema = z.object({
  name: z.string().min(2),
  url: z.string().url("URL inválida"),
  why_relevant: z.string().optional().nullable(),
  hook_examples: z.string().optional().nullable(),
});

export const referenceLinkSchema = z.object({
  title: z.string().min(2),
  url: z.string().url("URL inválida"),
  kind: z.enum([
    "substack",
    "newsletter",
    "blog",
    "portal",
    "podcast",
    "youtube",
    "other",
  ]),
  notes: z.string().optional().nullable(),
});

export const leaderDocumentSchema = z.object({
  name: z.string().min(2),
  content: z.string().min(20, "Conteúdo muito curto"),
  kind: z.string().default("background"),
});

export const generateContentSchema = z.object({
  format: z.enum(["linkedin_post", "article"]),
  topic: z.string().min(5),
  brief: z.string().optional().nullable(),
  extra_instructions: z.string().optional().nullable(),
  hook_style: z.string().optional().nullable(),
  objective: z.string().optional().nullable(),
  content_type: z.string().optional().nullable(),
  length: z.enum(["short", "medium", "long"]).optional().nullable(),
  tone_override: z.array(z.string()).optional().nullable(),
  variations: z.number().int().min(1).max(3).optional().default(1),
  mood: z.enum(["best_day", "critical", "reflective"]).optional().nullable(),
  fact_check: z.boolean().optional().default(false),
  // Lista de fatos extraídos da compreensão dos materiais anexados.
  // O polish-pass verifica que o draft cita pelo menos UM. Se vazio,
  // sem verificação (líder não anexou material com fatos extraíveis).
  must_cite_facts: z.array(z.string()).optional().nullable(),
  // URLs de materiais que o líder anexou MAS o sistema NÃO conseguiu
  // ler (substack com paywall, sites com cloudflare, PDFs corrompidos).
  // Quando essa lista vem cheia, ATIVAMOS web_search automaticamente e
  // damos instrução EXPLÍCITA pro modelo NÃO INVENTAR conteúdo dos
  // materiais. Se não conseguir buscar, aborta com mensagem clara.
  unreadable_sources: z
    .array(z.object({ url: z.string().nullable(), title: z.string() }))
    .optional()
    .nullable(),
});

export const reviseContentSchema = z.object({
  draft_id: z.string().uuid(),
  instructions: z.string().min(5),
});

export const orgDocumentSchema = z.object({
  name: z.string().min(2),
  content: z.string().min(10),
  kind: z.string().default("voice_guidelines"),
  is_active: z.boolean().default(true),
});

export const audienceFilterSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }),
  z.object({
    mode: z.literal("specific_users"),
    user_ids: z.array(z.string().uuid()).min(1, "Selecione ao menos 1 líder"),
  }),
  z.object({
    mode: z.literal("by_area"),
    areas: z.array(z.string().min(1)).min(1, "Selecione ao menos 1 área"),
  }),
  z.object({
    mode: z.literal("by_role"),
    roles: z.array(z.string().min(1)).min(1, "Selecione ao menos 1 cargo"),
  }),
]);

export const campaignSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  theme: z.string().min(10, "Tema obrigatório"),
  brief: z.string().optional().nullable(),
  format: z.enum(["linkedin_post", "article"]).default("linkedin_post"),
  notes: z.string().optional().nullable(),
  target_publish_date: z.string().optional().nullable(),
  audience_filter: audienceFilterSchema.default({ mode: "all" }),
});

export const visualSchema = z.object({
  draft_id: z.string().uuid().optional().nullable(),
  topic: z.string().min(5),
  brief: z.string().optional().nullable(),
  kind: z.literal("infographic"),
  archetype: z
    .enum(["stats_grid", "process_flow", "comparison", "timeline", "key_insight"])
    .optional()
    .nullable(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type ProfileStyleInput = z.infer<typeof profileStyleSchema>;
export type ReferenceProfileInput = z.infer<typeof referenceProfileSchema>;
export type ReferenceLinkInput = z.infer<typeof referenceLinkSchema>;
export type LeaderDocumentInput = z.infer<typeof leaderDocumentSchema>;
export type GenerateContentInput = z.infer<typeof generateContentSchema>;
export type OrgDocumentInput = z.infer<typeof orgDocumentSchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;
export type VisualInput = z.infer<typeof visualSchema>;
