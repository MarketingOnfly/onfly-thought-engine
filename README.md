# Onfly Thought Engine

App interno da Onfly para líderes produzirem thought leadership (posts de LinkedIn e artigos de
autoridade) em escala, sem freelancer e sem soar como IA. Cada saída é calibrada pelo perfil,
referências e tom do próprio líder, com guidelines da Onfly injetadas pelo admin.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + componentes inspirados em shadcn/ui
- Supabase (Auth via magic link + Postgres com RLS)
- Anthropic SDK — modelo `claude-sonnet-4-6` com prompt caching

## Arquitetura em uma tela

```
[ Líder ]                                 [ Admin ]
   ↓                                          ↓
Onboarding (5 passos)                  /admin: org_documents
   ↓                                          ↓
leader_profiles      ─────────┐        ┌───── org_documents
reference_profiles   ─────────┤        │      (voice, pillars,
reference_links      ─────────┼─► Prompt do líder
leader_documents     ─────────┤        │      onfly_facts...)
                     ─────────┘        │
                                       ↓
                        Claude (Sonnet 4.6, com cache do system prompt)
                                       ↓
                          Post de LinkedIn  ·  Artigo de autoridade
                                       ↓
                          Revisão em linguagem natural (loop)
```

## Setup

### 1. Pré-requisitos

- Node.js 20+ (testado com 22.11)
- Conta Supabase (free tier serve)
- Conta Anthropic com API key

### 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```
ANTHROPIC_API_KEY=sk-ant-...

NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # apenas para scripts admin futuros

ADMIN_EMAILS=vinicius.lima@onfly.com.br,outro.lider@onfly.com.br

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`ADMIN_EMAILS` é a lista de e-mails (separados por vírgula) que ganham acesso a `/admin` sem
precisar ser adicionados na tabela `org_admins`. Você também pode promover um usuário rodando:

```sql
insert into public.org_admins (user_id)
select id from auth.users where email = 'novo.admin@onfly.com.br';
```

### 3. Banco

No painel do Supabase, abra **SQL Editor** e rode `supabase/schema.sql` integralmente. Isso cria:

- `leader_profiles` (1 por usuário)
- `reference_profiles`, `reference_links`, `leader_documents` (acervo por líder)
- `org_documents` + `org_admins` (guidelines globais, acesso restrito)
- `content_drafts` (posts e artigos)
- `topic_suggestions` (saída do discovery agent)

Todas as tabelas têm Row Level Security ativo: cada líder enxerga só os próprios dados, e
apenas admins escrevem em `org_documents`.

### 4. Auth

Em **Authentication → URL Configuration** do Supabase:

- Site URL: `http://localhost:3000` (e a URL de produção depois)
- Redirect URLs: adicione `http://localhost:3000/auth/callback` e a versão de produção

O fluxo é magic link via `signInWithOtp`. Sem senha.

### 5. Rodar local

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000). Login via magic link → onboarding em 5 passos
→ dashboard.

## Fluxos principais

### Onboarding (`/onboarding`)

5 passos, salva ao final de cada bloco:

1. **Identidade** — nome, cargo, área, LinkedIn.
2. **Audiência** — descrição em texto livre do público-alvo.
3. **Tom e objetivo** — chips de traços a usar e a evitar, exemplos colados, objetivo principal.
4. **Referências** — perfis (estilo) + fontes (substacks, newsletters, portais).
5. **Documentos** — qualquer texto longo que sirva de matéria-prima.

Só libera `/dashboard` quando `onboarding_completed = true`.

### Criar conteúdo (`/dashboard/create`)

- Escolhe formato: post de LinkedIn ou artigo de autoridade.
- Tema, briefing e instruções extras.
- `POST /api/content/generate` chama Claude com:
  - **System prompt cacheado** (cache_control: ephemeral) — perfil + org_documents + referências + documentos.
  - **User prompt** — tema, briefing, regras de formato.
- Retorna o draft, redireciona para `/dashboard/content/[id]`.

### Revisar (`/dashboard/content/[id]`)

- O editor mostra o draft renderizado (post como texto, artigo como markdown).
- Painel lateral aceita instruções de revisão em linguagem natural ("hook mais ácido", "tira a citação do final"). Chama `POST /api/content/revise`, que injeta o draft atual + instruções e devolve a versão nova. Cada revisão entra em `meta.revisions` como histórico.
- Botão "Marcar como aprovado" muda o status para `approved` e copia `draft_markdown` para `final_markdown`.

### Descobrir pautas (`/dashboard/discover`)

- O líder cadastra fontes em `/dashboard/library`.
- "Gerar ideias" chama `POST /api/discover`: baixa até 8 fontes, limpa HTML, manda pra Claude com o system prompt do líder, pede JSON estruturado com 6-10 ideias.
- Cada ideia tem ângulo autoral, "por que agora", score e fonte. Clicar "Gerar post" leva pro `/dashboard/create` com tema e briefing pré-preenchidos.

### Admin (`/admin`)

- Só acessível para `ADMIN_EMAILS` ou linhas em `org_admins`.
- CRUD de `org_documents`. Cada documento ativo é injetado integralmente no system prompt de **todos** os líderes — então edição aqui muda o tom de todas as gerações futuras.
- Tipos sugeridos: `voice_guidelines`, `forbidden`, `pillars`, `onfly_facts`, `tone_examples`.

## Anti-IA

O prompt do líder inclui um bloco fixo de regras anti-IA: sem em dashes decorativos, sem paralelismos negativos, sem três adjetivos em fila, sem hooks "🚀 3 lições...", português brasileiro corporativo de operador. As guidelines do admin reforçam o mesmo. Mesmo assim, o líder ainda pode revisar em linguagem natural caso algo escape.

## Deploy (Vercel)

1. `npm run build` precisa passar localmente.
2. Conecte o repo no Vercel.
3. Configure as mesmas variáveis de `.env.local` no painel da Vercel (Production + Preview).
4. No Supabase, adicione a URL de produção em `Authentication → URL Configuration`.
5. Em "Project Settings → Functions", suba o timeout das rotas `/api/content/generate`, `/api/content/revise` e `/api/discover` para 60s (já marcado via `maxDuration`).

## Estrutura

```
app/
  page.tsx                          landing
  login/                            magic link
  auth/
    callback/                       troca code -> session
    signout/
  onboarding/                       wizard de 5 passos
  dashboard/
    layout.tsx                      sidebar + auth gate
    page.tsx                        overview
    create/                         gerador de post/artigo
    content/[id]/                   editor de draft
    discover/                       descoberta de pauta
    library/                        biblioteca (drafts + refs + docs)
    profile/                        editar perfil
  admin/                            CRUD de org_documents
  api/
    profile/
    references/
      profiles/
      links/
    documents/
    content/
      generate/                     Claude → draft
      revise/                       Claude → revisão
      [id]/
    discover/                       fetch + Claude → ideias
    admin/
      org-docs/
components/
  ui/                               primitives (button, input, select...)
  markdown.tsx                      renderer próprio (sem dep externa)
lib/
  anthropic/
    client.ts                       SDK + MODEL constant
    prompts.ts                      system + user prompts (HUMANIZER_RULES)
    context.ts                      carrega bundle do líder
  supabase/
    client.ts                       browser
    server.ts                       server / cookies
    middleware.ts                   refresh de sessão
  db/types.ts                       tipagem das tabelas
  fetch-source.ts                   download + strip HTML para discovery
  validation.ts                     zod schemas
  utils.ts
supabase/
  schema.sql                        rode no SQL editor do Supabase
middleware.ts                       gating de /dashboard /onboarding /admin
```

## Roadmap curto

- Upload de PDF em `leader_documents` (hoje só texto colado).
- Suporte a vetor/embeddings em vez de dump bruto (limita custo quando o líder tem muito documento).
- "Calendário editorial": agendar drafts aprovados via integração com LinkedIn API.
- Métricas pós-publicação (impressões, salvamentos) puxadas do LinkedIn por líder.
