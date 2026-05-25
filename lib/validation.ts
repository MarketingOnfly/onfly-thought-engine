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
  target_audience: z
    .string()
    .min(20, "Descreve a audiência com pelo menos uma frase completa"),
  tone_traits: z.array(z.string()).min(1, "Escolhe ao menos 1 traço"),
  tone_avoid: z.array(z.string()).default([]),
  tone_examples: z.string().optional().nullable(),
  main_objective: z
    .string()
    .min(20, "Descreve o objetivo em pelo menos uma frase completa"),
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

export type ProfileInput = z.infer<typeof profileSchema>;
export type ReferenceProfileInput = z.infer<typeof referenceProfileSchema>;
export type ReferenceLinkInput = z.infer<typeof referenceLinkSchema>;
export type LeaderDocumentInput = z.infer<typeof leaderDocumentSchema>;
export type GenerateContentInput = z.infer<typeof generateContentSchema>;
export type OrgDocumentInput = z.infer<typeof orgDocumentSchema>;
