# FarmaQuiz — publicar sem complicação

Você vai usar só o navegador: **Supabase** (banco + API) e **GitHub** (guarda o site e o publica de graça no GitHub Pages). Nada de instalar programas.

## Passo 1 — Criar o projeto no Supabase (5 min)
1. Entre em supabase.com, crie uma conta e clique em **New project**. Anote a senha do banco.
2. Quando ficar pronto, vá em **Project Settings → General** e copie o **Reference ID** (ex.: `abcdefghijklmno`).
3. Vá em **Authentication → Sign In / Providers** e **desligue** "Allow new users to sign up".

## Passo 2 — Criar as tabelas e o conteúdo (5 min)
1. Abra **SQL Editor → New query**.
2. Abra o arquivo `supabase/instalar-1-estrutura.sql`, copie **tudo**, cole no editor e clique **Run**. Deve aparecer "Success".
3. Nova query: copie `supabase/instalar-2-conteudo.sql` (as 100 questões), cole e clique **Run**.

## Passo 3 — Publicar a API (5 min)
1. Vá em **Edge Functions → Deploy a new function → Via Editor**. Nome: `api`.
2. Apague o código de exemplo, cole **todo** o conteúdo de `supabase/functions/api/index.ts` e clique **Deploy**.
3. Abra a função `api`, na aba de detalhes/configurações, e **desligue a verificação de JWT** ("Verify JWT" / "Enforce JWT verification"). É obrigatório: por padrão o Supabase exige um JWT e recusaria todos os pedidos (erro 401); a função `api` usa o próprio controle de sessão.
4. Em **Edge Functions → Secrets**, adicione dois segredos:
   - `IP_HASH_SALT` = qualquer texto longo e aleatório (30+ caracteres);
   - `ALLOWED_ORIGIN` = o endereço do seu site, **sem barra no final e sem caminho**, ex.: `https://seuusuario.github.io`.
5. O endereço da API é: `https://SEU-REFERENCE-ID.supabase.co/functions/v1/api`.

## Passo 4 — Colocar o site no ar (5 min)
1. Abra o arquivo `docs/config.js` e troque `SEU-PROJETO` pelo seu Reference ID (nas duas linhas) e cole a chave **pública** (Supabase → Project Settings → **API Keys** → *Publishable key*, que começa com `sb_publishable_`; em projetos antigos pode se chamar *anon*). Essa chave é pública por natureza; **nunca** coloque a *secret key* (`sb_secret_`) nem a `service_role` em nenhum arquivo.
2. Em github.com, crie um repositório e envie **todos os arquivos** desta pasta (botão *Add file → Upload files*; arraste tudo).
   Não envie nenhum arquivo `.env` com senhas.
3. No repositório: **Settings → Pages → Build and deployment → Deploy from a branch → Branch: `main` / pasta `/docs` → Save**.
4. Em 1–2 minutos o site abre em `https://seuusuario.github.io/NOME-DO-REPOSITORIO/`.
   (Se usar outro endereço depois, lembre de atualizar o segredo `ALLOWED_ORIGIN`.)

## Passo 5 — Testar
Abra o site, cadastre-se com nome e telefone e estude. Se aparecer "O site ainda não foi configurado", falta o Passo 4.1. Se aparecer erro de conexão, confira `ALLOWED_ORIGIN` e o "Verify JWT" desligado.

## Passo 6 — Primeiro administrador
1. Supabase → **Authentication → Users → Add user** (e-mail e senha forte; marque *Auto Confirm*).
2. **SQL Editor**, rode (trocando o e-mail):
```sql
insert into public.admin_profiles (user_id, display_name, role)
select id, 'Seu Nome', 'owner' from auth.users where email = 'seu@email.com';
```
3. (Opcional) Você pode cadastrar o Pix direto pelo painel, na tela **Chave Pix**. Se preferir pelo SQL Editor:
```sql
update public.platform_settings set value = '"Nome do Recebedor"' where key = 'pix_receiver_name';
update public.platform_settings set value = '"Nome do Banco"'     where key = 'pix_bank';
update public.platform_settings set value = '"sua-chave-pix"'     where key = 'pix_key';
```

## Usando o painel administrativo
Abra `https://seuusuario.github.io/NOME-DO-REPOSITORIO/admin/` e entre com o e-mail e a senha do Passo 6. Recomendo ativar a verificação em duas etapas na sua conta do Supabase e usar senha forte.

- **Assinatura:** o estudante clica em *Pagamento concluído* → aparece em **Assinaturas** como “pagamento informado” → você confere o Pix → **Gerar e enviar código** → o código chega no app dele e ele só toca em *Ativar*.
- **Chave Pix:** em **Chave Pix** você troca recebedor, banco e chave (vale para todos na hora) e envia a nova chave a quem avisou que não funcionava.
- **Códigos:** gere códigos individuais (7, 30, 90, 180, 365 dias ou outro valor), copie e envie. Cada um só vale uma vez.
- **Estudantes:** busque por nome ou telefone, conceda ou estenda licença, suspenda, encerre sessões, gere código de **recuperação** (quando o aluno trocou de aparelho) e anote observações.
- **Novidades:** publique avisos; os estudantes veem um contador no app.
- **Conteúdo:** edite questões (com prévia), crie disciplinas e temas, escolha quais disciplinas ficam **liberadas no teste**, trate avisos de erro, importe e exporte em JSON. As 100 questões iniciais estão marcadas “precisa de revisão”: peça a um professor para conferir e desmarque ao validar.
- **Configurações** (só `owner`): duração do teste, mensagens e modo manutenção. **Auditoria**: histórico de tudo que foi feito.

Perfis: `owner` (tudo), `admin` (estudantes, códigos, assinaturas, conteúdo), `editor` (só conteúdo e novidades). Para cadastrar outra pessoa da equipe, crie o usuário em *Authentication → Users* e rode no SQL Editor:
```sql
insert into public.admin_profiles (user_id, display_name, role)
select id, 'Nome', 'admin' from auth.users where email = 'email@dela.com';
```

> Antes de divulgar: preencha os campos entre [colchetes] em `docs/termos.html` e `docs/privacidade.html` e peça revisão profissional.
