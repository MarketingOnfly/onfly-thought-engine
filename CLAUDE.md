# Onfly Thought Engine — notas pra Claude

Contexto operacional pra qualquer próxima sessão de Claude trabalhando neste repo.

## Repositório e deploy

- **Git remote (oficial)**: `git@github.com:MarketingOnfly/onfly-thought-engine.git` (SSH)
- **Chave SSH ativa**: "SSH Key Vini" (SHA256:XpZ7Uw7qMNPBqt3NzfbaLl+XU5rkDqidu4RygtpIRVA)
- **Identidade git ao puxar/empurrar**: MarketingOnfly (a org do time de Marketing)
- **Branch principal**: `main`
- **Vercel project**: `onfly-thought-engine` no team `marketing-onfly`
- **URL produção atual**: https://onfly-thought-engine.vercel.app/

O deploy é automatizado por push pro `main` do repo MarketingOnfly. Para subir mudanças:
```
git add .
git commit -m "mensagem"
git push origin main
```

Não usar o remote antigo `vinicius-onfly/onfly-thought-engine` — está descontinuado.

## Stack

- Next.js 15.3.9 (App Router) + TypeScript + Tailwind
- Supabase (Auth magic-link + email/senha, Postgres + RLS, Storage)
- Anthropic SDK — `claude-opus-4-7` (default) e `claude-sonnet-4-6` (review)
- Migrations idempotentes em `supabase/migrations/*.sql`

## Comandos típicos

- `npm run dev` — dev server (porta 3000 default)
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — production build local
- `node scripts/verify-migrations.mjs` — confere se migrations rodaram no Supabase

## Variáveis de ambiente (produção, Vercel)

Conferidas no .env.local local + estão setadas na Vercel:
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (atenção: pode estar como placeholder em dev)
- `ADMIN_EMAILS` — emails que ganham acesso ao /admin (comma-separated)
- `NEXT_PUBLIC_APP_URL` — URL pública (precisa bater com o deploy pra magic links)
- `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` / `LINKEDIN_REDIRECT_URI`

## Como falar com o Vini (o usuário)

- Vini é CMO, não dev. Instruções precisam ser ELI12 ("explica como pra um menino de 12 anos").
- Sempre indicar **explicitamente** se uma ação é "abrir aba nova" ou "mexer em código existente". Default: aba nova.
- Pra qualquer SQL: deixar claro que vai no SQL Editor do Supabase, em uma **nova query** (botão "+ New query" no canto superior direito), e que o resultado esperado é "Success. No rows returned" em verde.
- Nunca pedir pra ele mexer em queries antigas salvas na lateral do Supabase — todas as migrations devem ser SQL idempotente (`if not exists`, `drop policy if exists`).
- Quando ele descrever um erro, pedir o texto exato — não adivinhar.

## Barreira entre líderes (IMPORTANTE — não quebrar)

Cada líder tem **aprendizado isolado**. Feedback do Vini não pode contaminar
o prompt do Fred. As fronteiras que garantem isso, em ordem do banco pro
prompt:

1. **RLS em `content_feedback`** — política "self all" bloqueia leitura/
   escrita cross-user. Único bypass: service_role (usado só pelo backend
   em operações explícitas).
2. **`leader_profiles.learned_preferences` é per-user** — coluna em uma
   linha por líder.
3. **`recomputeLearnedPreferences(userId)`** filtra `.eq("user_id", userId)`
   no SELECT e no UPDATE. Toda chamada vem do POST /api/content/[id]/feedback
   onde `userId = user.id` do usuário autenticado.
4. **No prompt**, `learned_preferences` é injetado dentro de
   `describeLeader(profile)` em `lib/anthropic/prompts.ts` — função que
   recebe um perfil único por vez.

O que é GLOBAL (compartilhado entre todos os líderes) e deve continuar global:
- `HUMANIZER_RULES`
- `POST_GUIDELINES` / `ARTICLE_GUIDELINES`
- `org_documents` (frameworks que o admin curou)
- `HOOK_STYLES`, `OBJECTIVES`, `TONE_TRAITS`, etc — catálogos

**Regra dura**: aprendizado individual fica em `describeLeader()`. Não
mover pra HUMANIZER_RULES nem pra constantes de módulo. Se for tentado a
"generalizar" o aprendizado de um líder pra todos, é violação direta.

## Princípios de produto

- **Voz própria do líder**, nunca da Onfly nem com cara de IA.
- **PT-BR de operador**, sem floreio corporativo, sem americanismo cru.
- **Mínimo de digitação**: a calibragem é por seleção (Style Studio), o líder só digita o tema.
- **Mostrar o trabalho**: o que o motor extraiu de cada referência fica visível
  (hooks, padrões de estilo, tom, posicionamento, temas).
- Regras anti-IA em `lib/anthropic/prompts.ts` (HUMANIZER_RULES, ~45 regras) são
  o backbone da qualidade — nunca diluir.
