-- 017: tags estruturadas no feedback
--
-- Problema: feedback era rating + comentário livre. O comentário vago
-- ("vários termos técnicos e simplista") virava bullet abstrato no
-- learned_preferences e o modelo não mudava comportamento.
--
-- tags = array JSON de chaves estruturadas que o líder marca em chips:
-- ["cara_de_ia", "inventou_fato", "ignorou_material", "jargao",
--  "sem_historia", "hook_fraco", "tom_errado", "muito_longo",
--  "muito_curto", "generico"]
--
-- Idempotente: pode rodar mais de uma vez sem erro.

alter table content_feedback
  add column if not exists tags jsonb not null default '[]'::jsonb;

comment on column content_feedback.tags is
  'Tags estruturadas de problemas/acertos marcadas pelo líder (chips na UI). Alimentam o learned_preferences com sinal limpo em vez de só texto livre.';
