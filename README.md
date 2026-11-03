# FarmaQuiz — Etapas 1 a 3: banco, acesso, API e conteúdo

> Aprenda Farmácia, uma questão de cada vez.

**Etapa 1:** esquema PostgreSQL, RLS, funções de acesso/resgate e testes SQL (migrations 0001-0004).
**Etapa 2:** perfil/avatar, ranking, assinatura via Pix (planos 3 e 6 meses), avisos de chave Pix, novidades, teste restrito a disciplinas liberadas, funções de estudo/simulado/desempenho (migrations 0005-0006) e a **API dos estudantes** (`supabase/functions/api`).
**Guia sem terminal: [COMECE-AQUI.md](COMECE-AQUI.md).**
**Etapa 4:** app do estudante em `docs/` (HTML/CSS/JS puros, sem build; publica direto no GitHub Pages). Testes: `node tools/test_frontend.mjs`.
**Etapa 3:** 5 disciplinas, 72 temas e **100 questões originais** (20 por disciplina) na migration `0007_seed_content.sql`.
**Etapa 5:** painel administrativo em `docs/admin/` (Supabase Auth + funções `admin_*`). Testes: `node tools/test_admin_views.mjs`.

## Arquitetura de acesso (resumo)

| Quem | Como autentica | Como fala com o banco |
|---|---|---|
| Estudante | Sessão própria: token aleatório de 256 bits gerado na Edge Function; só o **hash SHA-256** fica no banco | Somente via Edge Functions (`service_role`). Sem acesso direto às tabelas |
| Administrador | Supabase Auth (e-mail + senha; ative MFA) + linha em `admin_profiles` | RLS + funções `admin_*` que conferem o papel no servidor |

- O **telefone não é credencial**: serve só para evitar cadastro duplicado. Telefone já cadastrado **não** gera sessão; a recuperação é por token emitido pelo administrador (`admin_create_recovery_token` → `recover_access`).
- Papéis: `editor` (conteúdo) < `admin` (estudantes, códigos, licenças) < `owner` (configurações e outros admins).
- Quem decide se há acesso é só `access_state()` no servidor (`licensed | trial | expired | suspended`).
- Resgate (`redeem_access_code`): trava a linha do código (`FOR UPDATE`) + advisory lock por estudante + `UNIQUE(licenses.access_code_id)`; vencimento calculado no servidor; falhas ficam registradas para limitar tentativas.
- Nova licença sobre uma ativa **estende a partir do vencimento atual** (`admin_grant_license` aceita `replace` explicitamente).
- Licenças têm `source` (`access_code`, `admin_grant`, `payment`, `promo`) e `plans`, para plugar Pix/assinaturas depois sem reescrever o acesso.

## Aplicar as migrations

```bash
npm i -g supabase            # ou use npx supabase
supabase login
supabase link --project-ref SEU_REF
supabase db push             # aplica supabase/migrations/0001..0004
```
Local: `supabase start && supabase db reset`.

**Depois de aplicar**, no painel do Supabase: *Authentication → Sign In / Providers* → **desative "Allow new users to sign up"**.

## Criar o primeiro administrador (com segurança)

1. Supabase → *Authentication → Users → Add user* (e-mail + senha forte; marque "Auto Confirm").
2. No *SQL Editor* (acesso restrito a você), promova esse usuário:
```sql
insert into public.admin_profiles (user_id, display_name, role)
select id, 'Seu Nome', 'owner' from auth.users where email = 'seu@email.com';
```
Não existe credencial fixa no código e o frontend não consegue criar admins (RLS só permite `owner`).

## Publicar a API (Edge Function)

```bash
supabase secrets set IP_HASH_SALT=$(openssl rand -hex 32) ALLOWED_ORIGIN=https://seu-dominio.vercel.app
supabase functions deploy api --no-verify-jwt     # config.toml já define verify_jwt = false
deno test --allow-env supabase/functions/api/index_test.ts
```
Rotas (cabeçalho `x-session-token` nas autenticadas): `POST /register`, `/recover`, `/redeem`, `/logout`, `/profile`;
`GET /me /settings /subjects /stats /ranking?period=week /announcements`; `/subscription` (+ `/request /paid /pix-problem /ack-pix /activate`);
`POST /sessions`, `GET /sessions/active`, `/sessions/:id`, `/sessions/:id/questions/:i`, `POST /sessions/:id/answer|finish`, `GET /sessions/:id/review`; `POST /favorites /flags`.
O token de sessão é guardado pelo frontend; para usar cookie HttpOnly, sirva a API no mesmo domínio por rewrite da Vercel.

## Rodar os testes SQL

```bash
supabase db reset
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -v ON_ERROR_STOP=1 -f supabase/tests/001_access_and_redeem.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/003_study_and_subscription.sql
```
Cobre: teste de 7 dias, não reinício, licença ativa, acesso vencido, código válido/reutilizado/revogado/expirado/de outro estudante, extensão, rate limit, suspensão, auditoria, RLS e bloqueio de ações administrativas. Concorrência: `supabase/tests/002_concurrent_redeem.md`.

## Decisões e limitações a conhecer

- **Não testei o SQL em um PostgreSQL real** (o ambiente de desenvolvimento não tinha PostgreSQL nem rede). Rode os testes acima antes de seguir; se algo falhar, me envie a saída que eu corrijo.
- `access_codes.code_plain` guarda o código completo **apenas enquanto disponível**, para o admin poder copiá-lo e enviá-lo; é apagado ao resgatar/revogar. Quem tiver acesso ao banco veria códigos ainda não usados. Alternativa mais restrita: mostrar o código só na criação.
- O telefone não comprova identidade. Por isso um segundo aparelho exige token de recuperação do admin.
- Auditoria cobre ações de acesso/licenças/códigos/configurações. A edição de questões, disciplinas e temas pelo painel **ainda não gera registro de auditoria** (limitação conhecida).
- Valores sensíveis (`IP_HASH_SALT`) ficam só nas Edge Functions; veja `.env.example`.

## Conteúdo inicial (Etapa 3)

- Fonte editável: `tools/content_data.py`. Para alterar o conteúdo inicial: edite esse arquivo e rode `python3 tools/gen_seed.py` (valida 4 alternativas distintas, 20 por disciplina, sem enunciados repetidos e gera a migration). Depois do deploy, **use o painel** para editar questões; a migration só insere (`ON CONFLICT DO NOTHING`).
- Todas as questões entram **publicadas e com `needs_review = true`**, porque o conteúdo foi escrito por IA e **precisa de revisão por um professor** antes de uso oficial, em especial fisiologia, bioquímica, biossegurança e legislação.
- **Referências bibliográficas estão vazias** de propósito: nenhuma fonte foi inventada. Preencha pelo painel depois de conferir o livro ou a norma.
- A posição da alternativa correta está distribuída (A–D); a cada sessão o servidor embaralha de novo.
- Anatomia e Citologia vêm liberadas para o teste (`available_in_trial`); mude pelo painel.
- Teste de integridade: `psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/004_seed_integrity.sql`.

## Regras novas da Etapa 2

- **Teste restrito:** `subjects.available_in_trial` define o que o teste acessa; o servidor filtra sessões, questões, respostas e favoritos. Licença libera tudo.
- **Gabarito:** `is_correct` só sai após responder (estudo/revisão) ou ao finalizar (simulado). Alternativas são embaralhadas por questão no servidor e a correção usa o ID da alternativa.
- **Respostas idempotentes:** `UNIQUE(session_id, question_id)`; reenviar devolve a resposta original (`already_answered`).
- **Assinatura:** aluno pede plano → informa pagamento → admin confere o Pix e gera o código → o código fica preso à conta e **nunca vai ao aparelho**; o aluno só toca em ativar (`student_activate_delivered_code`).
- **Pix:** chave/recebedor/banco ficam em `platform_settings` e valem para todos ao salvar (`admin_set_pix`). O aviso do aluno só pode ser respondido depois de trocar a chave.
- **Ranking:** 10 pontos por questão *distinta* acertada; só primeiro nome e avatar; o aluno pode sair.

## Próximas etapas

3. ✅ Seed: 5 disciplinas, temas e 100 questões originais.
4. Frontend React/TS/Tailwind (estudante + painel admin).
5. Testes automatizados, README completo e publicação.
