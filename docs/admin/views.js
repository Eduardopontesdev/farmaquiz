// Painel administrativo | telas (funções puras: dados -> HTML). Todo texto dinâmico passa por esc().
import { esc, money } from "../js/ui.js";

export const dt = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR") : "—");
export const dd = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const err = (m) => `<div class="err" role="alert">${esc(m || "")}</div>`;

export const ACTION = {
  "student.registered": "Cadastro de estudante", "student.recovered": "Acesso recuperado", "student.name_changed": "Nome alterado",
  "student.status_changed": "Status do estudante alterado", "student.sessions_revoked": "Sessões revogadas",
  "student.recovery_token_created": "Código de recuperação criado", "student.notes_changed": "Observações alteradas",
  "code.created": "Códigos gerados", "code.redeemed": "Código resgatado", "code.revoked": "Código revogado",
  "license.granted": "Licença concedida", "license.end_changed": "Vencimento alterado", "license.revoked": "Licença revogada",
  "subscription.requested": "Assinatura solicitada", "subscription.payment_reported": "Pagamento informado",
  "subscription.code_sent": "Código enviado ao estudante", "subscription.cancelled": "Assinatura cancelada",
  "pix.problem_reported": "Problema na chave Pix", "pix.changed": "Chave Pix alterada", "pix.sent_to_student": "Nova chave enviada",
  "pix.sent_to_all": "Nova chave enviada a todos", "announcement.published": "Novidade publicada", "announcement.removed": "Novidade removida",
  "setting.changed": "Configuração alterada",
};
const SUB_ST = { pending: "Aguardando pagamento", payment_reported: "Pagamento informado", code_sent: "Código enviado", activated: "Ativada", cancelled: "Cancelada" };
const ACC_ST = { trial: "Em teste", licensed: "Licença ativa", expired: "Vencido", suspended: "Suspenso", none: "—" };
const Q_ST = { draft: "Rascunho", published: "Publicada", archived: "Arquivada" };
const DIFF = { facil: "Fácil", medio: "Médio", dificil: "Difícil" };
const accPill = (s) => `<span class="pill ${s === "licensed" ? "ok" : s === "expired" || s === "suspended" ? "bad" : "warn"}">${esc(ACC_ST[s] || s)}</span>`;

// ---------- estrutura ----------
export const viewLogin = (e = "") => `<div class="wrap"><h1>Painel administrativo</h1><p class="mut">Acesso restrito à equipe do FarmaQuiz.</p>
<form class="card" data-form="login" novalidate><label for="em">E-mail</label><input id="em" name="em" type="email" autocomplete="username" required>
<label for="pw">Senha</label><input id="pw" name="pw" type="password" autocomplete="current-password" required>${err(e)}<button class="btn" type="submit">Entrar</button></form></div>`;
export const viewNoPerm = () => `<div class="wrap"><div class="card"><h1>Sem permissão</h1><p>Esta conta não tem acesso ao painel. Peça ao responsável para cadastrá-la como administradora.</p><button class="btn alt" data-act="logout">Sair</button></div></div>`;
export function viewShell({ active, items, name, role, body }) {
  return `<div class="wrap wide"><header class="top"><span class="logo"><img src="../img/icon.svg" alt="" width="34" height="34"><span>FarmaQuiz · Admin</span></span><span class="chip">${esc(name)} · ${esc(role)}</span></header>
<nav class="adminnav" aria-label="Seções">${items.map(([k, l]) => `<a href="#/${k}" ${active === k ? 'aria-current="page"' : ""}>${esc(l)}</a>`).join("")}<a href="#" data-act="logout">Sair</a></nav>${body}</div>`;
}

// ---------- painel ----------
export function viewDash({ stats: s, pays, alerts }) {
  const c = (n, l, href) => `<${href ? `a href="#/${href}"` : "div"} class="stat">${""}<b>${n}</b><span>${esc(l)}</span></${href ? "a" : "div"}>`;
  return `<h1>Painel</h1>
${pays || alerts ? `<div class="fb bad" role="status"><b>Atenção:</b> ${pays ? `<a href="#/subs">${pays} pagamento(s) informado(s) para conferir</a>` : ""}${pays && alerts ? " · " : ""}${alerts ? `<a href="#/pix">${alerts} aviso(s) de chave Pix com problema</a>` : ""}</div>` : `<div class="fb ok">Nada pendente por aqui.</div>`}
<div class="cardgrid">${c(s.students_total, "estudantes", "students")}${c(s.students_trial, "em teste")}${c(s.licenses_active, "licenças ativas")}${c(s.students_expired, "vencidos")}${c(s.students_suspended, "suspensos")}${c(s.codes_available, "códigos disponíveis", "codes")}${c(s.codes_redeemed, "códigos resgatados")}${c(`${s.questions_published}/${s.questions_total}`, "questões publicadas", "content")}${c(s.subjects_total, "disciplinas")}${c(s.flags_open, "avisos de erro abertos", "content/f")}</div>
<div class="card"><h2>Atividade recente</h2>${s.recent_activity.length ? `<ul class="clean">${s.recent_activity.map((a) => `<li>${esc(ACTION[a.action] || a.action)} <span class="mut tiny">· ${esc(dt(a.created_at))}</span></li>`).join("")}</ul>` : `<p class="mut">Sem atividade ainda.</p>`}</div>`;
}

// ---------- assinaturas e Pix ----------
export function viewSubs(list) {
  const rows = list.map((r) => {
    const open = r.status === "pending" || r.status === "payment_reported";
    return `<tr><td>${esc(r.student_name)}</td><td>${esc(r.plan_name)}<br><span class="tiny mut">${money(r.price_cents)}</span></td><td>${esc(dt(r.created_at))}</td>
<td>${r.status === "payment_reported" ? `<span class="pill bad">${SUB_ST[r.status]}</span><br><span class="tiny mut">${esc(dt(r.payment_reported_at))}</span>` : `<span class="pill">${esc(SUB_ST[r.status] || r.status)}</span>`}</td>
<td><div class="actions">${open ? `<button class="btn sm" data-act="sendcode" data-id="${esc(r.id)}">Gerar e enviar código</button>` : ""}${r.code ? `<code>${esc(r.code)}</code>` : ""}${open || r.status === "code_sent" ? `<button class="btn alt sm" data-act="cancelsub" data-id="${esc(r.id)}">Cancelar</button>` : ""}</div></td></tr>`;
  }).join("");
  return `<h1>Assinaturas</h1><div class="fb info small">Confira o Pix na sua conta <b>antes</b> de gerar o código. O código vai direto para o aplicativo do estudante, que só precisa tocar em ativar.</div>
<div class="card scroll">${list.length ? `<table><tr><th>Estudante</th><th>Plano</th><th>Pedido</th><th>Situação</th><th></th></tr>${rows}</table>` : `<p class="mut">Nenhuma solicitação ainda.</p>`}</div>`;
}
export function viewPix({ pix, alerts, msg = "" }) {
  const ready = alerts.filter((a) => a.ready_to_send).length;
  return `<h1>Chave Pix</h1>
<form class="card" data-form="pix" novalidate><p class="mut small">Ao salvar, a nova chave passa a valer automaticamente para todos os estudantes. Versão atual: ${pix.version}.</p>
<label for="rn">Nome do recebedor</label><input id="rn" name="rn" value="${esc(pix.receiver_name)}" maxlength="60">
<label for="bk">Banco</label><input id="bk" name="bk" value="${esc(pix.bank)}" maxlength="40">
<label for="ky">Chave Pix</label><input id="ky" name="ky" value="${esc(pix.key)}" maxlength="77">${err(msg)}<button class="btn" type="submit">Salvar chave</button></form>
<div class="card"><h2>Avisos de chave com problema</h2>${ready > 1 ? `<button class="btn alt sm mb" data-act="sendall">Enviar a todos que avisaram (${ready})</button>` : ""}
${alerts.length ? alerts.map((a) => `<div class="fb ${a.status === "open" ? "bad" : "ok"}"><b>${esc(a.student_name)}</b> · ${esc(dt(a.created_at))}<br>${a.status === "open" ? (a.ready_to_send ? `<button class="btn sm mt" data-act="sendpix" data-id="${esc(a.id)}">Enviar nova chave a este aluno</button>` : `<span class="small">Troque a chave acima para poder enviar.</span>`) : `<span class="small">Nova chave enviada em ${esc(dt(a.resolved_at))}.</span>`}</div>`).join("") : `<p class="mut">Nenhum aviso.</p>`}</div>`;
}

// ---------- estudantes ----------
export function viewStudents({ list, search }) {
  return `<h1>Estudantes</h1><form class="card" data-form="search" novalidate><label for="sq" class="mb">Buscar por nome ou telefone</label><div class="grid g2"><input id="sq" name="sq" value="${esc(search)}" placeholder="Maria ou 8899..."><button class="btn" type="submit">Buscar</button></div></form>
<div class="card scroll">${list.length ? `<table><tr><th>Nome</th><th>Telefone</th><th>Acesso</th><th>Vence</th><th>Cadastro</th></tr>${list.map((s) => `<tr><td><a href="#/student/${esc(s.id)}">${esc(s.full_name)}</a>${s.status === "suspended" ? ' <span class="pill bad">suspenso</span>' : ""}</td><td>${esc(s.phone_e164)}</td><td>${accPill(s.access_state)}</td><td>${esc(dd(s.access_ends_at))}</td><td>${esc(dd(s.created_at))}</td></tr>`).join("")}</table>` : `<p class="mut">Nenhum estudante encontrado.</p>`}</div>`;
}
export function viewStudent({ d, audit, newToken, newCode }) {
  const lic = d.licenses.map((l) => `<tr><td>${esc(l.source)}</td><td>${esc(dd(l.starts_at))}</td><td>${esc(dd(l.ends_at))}</td><td>${l.status === "active" ? '<span class="pill ok">ativa</span>' : '<span class="pill bad">revogada</span>'}</td><td>${l.status === "active" ? `<div class="actions"><button class="btn alt sm" data-act="revlic" data-id="${esc(l.id)}">Encerrar</button></div>` : ""}</td></tr>`).join("");
  return `<p><a href="#/students">‹ Estudantes</a></p><h1>${esc(d.full_name)} ${accPill(d.access.state)}</h1>
<div class="card"><p>Telefone (informado, <b>não verificado</b>): <b>${esc(d.phone_e164)}</b><br>Cadastro: ${esc(dt(d.created_at))} · Último acesso: ${esc(dt(d.last_seen_at))}<br>Acesso até: <b>${esc(dd(d.access.ends_at))}</b> · Sessões ativas: ${d.sessions_active} · Respostas: ${d.answers_total}${d.trial ? `<br>Teste: ${esc(dd(d.trial.started_at))} a ${esc(dd(d.trial.ends_at))}${d.trial.ended_reason ? " (encerrado ao ativar licença)" : ""}` : ""}</p></div>
${newToken ? `<div class="fb ok" role="status"><b>Código de recuperação (mostrado uma vez):</b> <code class="big">${esc(newToken.token)}</code><br><span class="small">Válido até ${esc(dt(newToken.expires_at))}. O estudante informa o telefone e este código em “Recuperar acesso”.</span></div>` : ""}
${newCode ? `<div class="fb ok" role="status"><b>Código individual (mostrado uma vez):</b> <code class="big">${esc(newCode)}</code> <button class="btn alt sm" data-act="copy" data-text="${esc(newCode)}">Copiar</button></div>` : ""}
<form class="card" data-form="grant" novalidate><h2>Conceder ou estender licença</h2><div class="grid g2"><div><label for="gd">Dias</label><select id="gd" name="gd"><option>7</option><option selected>30</option><option>90</option><option>180</option><option>365</option><option value="x">Outro…</option></select></div><div><label for="gx">Outro valor (dias)</label><input id="gx" name="gx" type="number" min="1" max="3650" placeholder="ex.: 45"></div></div>
<label for="gm">Se já houver licença ativa</label><select id="gm" name="gm"><option value="extend">Somar a partir do vencimento atual (padrão)</option><option value="replace">Substituir e começar agora</option></select><label for="gn">Observação</label><input id="gn" name="gn" maxlength="200"><div class="err" role="alert"></div><button class="btn" type="submit">Conceder licença</button></form>
<div class="card scroll"><h2>Licenças</h2>${d.licenses.length ? `<table><tr><th>Origem</th><th>Início</th><th>Fim</th><th>Situação</th><th></th></tr>${lic}</table>` : `<p class="mut">Sem licenças.</p>`}</div>
<div class="card"><h2>Ações</h2><div class="actions"><button class="btn alt" data-act="newcode">Gerar código individual (30 dias)</button><button class="btn alt" data-act="recovery">Gerar código de recuperação</button><button class="btn alt" data-act="revsess">Encerrar sessões e aparelhos</button><button class="btn ${d.status === "active" ? "alt" : ""}" data-act="${d.status === "active" ? "suspend" : "reactivate"}">${d.status === "active" ? "Suspender conta" : "Reativar conta"}</button></div></div>
<form class="card" data-form="notes" novalidate><h2>Observações administrativas</h2><textarea name="nt" maxlength="2000">${esc(d.admin_notes || "")}</textarea><div class="err" role="alert"></div><button class="btn" type="submit">Salvar observações</button></form>
<div class="card"><h2>Histórico</h2>${audit.length ? `<ul class="clean">${audit.map((a) => `<li>${esc(ACTION[a.action] || a.action)} <span class="mut tiny">· ${esc(dt(a.created_at))}</span></li>`).join("")}</ul>` : `<p class="mut">Sem registros.</p>`}</div>`;
}

// ---------- códigos ----------
export function viewCodes({ list, status, created }) {
  const st = { available: "Disponível", redeemed: "Resgatado", revoked: "Revogado", expired: "Expirado" };
  return `<h1>Códigos de acesso</h1>
<form class="card" data-form="gencodes" novalidate><h2>Gerar códigos</h2><div class="grid g2"><div><label for="cq">Quantidade (1 a 50)</label><input id="cq" name="cq" type="number" min="1" max="50" value="1"></div><div><label for="cd">Duração</label><select id="cd" name="cd"><option>7</option><option selected>30</option><option>90</option><option>180</option><option>365</option><option value="x">Outro…</option></select></div></div>
<label for="cx">Outra duração (dias)</label><input id="cx" name="cx" type="number" min="1" max="3650"><label for="cr">Prazo máximo para resgate (opcional)</label><input id="cr" name="cr" type="date"><label for="cn">Observação</label><input id="cn" name="cn" maxlength="200"><div class="err" role="alert"></div><button class="btn" type="submit">Gerar</button></form>
${created && created.length ? `<div class="fb ok" role="status"><b>Códigos gerados</b> <button class="btn alt sm" data-act="copy" data-text="${esc(created.join("\n"))}">Copiar todos</button><ul class="clean">${created.map((c) => `<li><code class="big">${esc(c)}</code></li>`).join("")}</ul><p class="small">Envie cada código a um estudante diferente. Cada código só pode ser usado uma vez.</p></div>` : ""}
<div class="tabs2">${[["", "Todos"], ["available", "Disponíveis"], ["redeemed", "Resgatados"], ["revoked", "Revogados"], ["expired", "Expirados"]].map(([k, l]) => `<button class="btn ${status === k ? "" : "alt"} sm" data-act="codefilter" data-s="${k}">${l}</button>`).join("")}</div>
<div class="card scroll">${list.length ? `<table><tr><th>Código</th><th>Dias</th><th>Situação</th><th>Criado</th><th>Resgate</th><th></th></tr>${list.map((c) => `<tr><td><code>${esc(c.code || c.code_hint)}</code></td><td>${c.duration_days}</td><td>${esc(st[c.status] || c.status)}</td><td>${esc(dd(c.created_at))}${c.intended_student_name ? `<br><span class="tiny mut">para ${esc(c.intended_student_name)}</span>` : ""}</td><td>${c.redeemed_at ? `${esc(dt(c.redeemed_at))}<br><span class="tiny mut">${esc(c.redeemed_by_name || "")}</span>` : c.redeem_by ? `até ${esc(dd(c.redeem_by))}` : "—"}</td><td><div class="actions">${c.code ? `<button class="btn alt sm" data-act="copy" data-text="${esc(c.code)}">Copiar</button><button class="btn alt sm" data-act="revcode" data-id="${esc(c.id)}">Revogar</button>` : ""}</div></td></tr>`).join("")}</table>` : `<p class="mut">Nenhum código.</p>`}</div>
<p class="tiny mut">Códigos já resgatados aparecem mascarados por segurança.</p>`;
}

// ---------- novidades ----------
export function viewNews({ items, msg = "" }) {
  return `<h1>Novidades</h1><form class="card" data-form="news" novalidate><label for="nt" class="mb">Título</label><input id="nt" name="nt" maxlength="80"><label for="nb">Mensagem</label><textarea id="nb" name="nb" maxlength="400"></textarea>${err(msg)}<button class="btn" type="submit">Publicar novidade</button></form>
<div class="card"><h2>Publicadas</h2>${items.length ? items.map((n) => `<div class="fb ${n.is_active ? "soft" : "bad"}"><b>${esc(n.title)}</b> ${n.is_active ? "" : '<span class="pill bad">removida</span>'}<br>${esc(n.body)}<br><span class="tiny mut">${esc(dt(n.created_at))}</span>${n.is_active ? ` <button class="btn alt sm" data-act="delnews" data-id="${esc(n.id)}">Remover</button>` : ""}</div>`).join("") : `<p class="mut">Nada publicado.</p>`}</div>`;
}

// ---------- conteúdo ----------
export const contentTabs = (a) => `<div class="tabs2">${[["q", "Questões"], ["s", "Disciplinas e temas"], ["f", "Avisos de erro"], ["io", "Importar / Exportar"]].map(([k, l]) => `<a class="btn ${a === k ? "" : "alt"} sm" href="#/content/${k}">${l}</a>`).join("")}</div>`;
export function viewQuestions({ list, subjects, f, more }) {
  return `<h1>Conteúdo</h1>${contentTabs("q")}<form class="card" data-form="qfilter" novalidate><div class="grid g2"><div><label for="fs">Disciplina</label><select id="fs" name="fs"><option value="">Todas</option>${subjects.map((s) => `<option value="${esc(s.id)}" ${f.subject === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
<div><label for="ft">Situação</label><select id="ft" name="ft"><option value="">Todas</option>${Object.entries(Q_ST).map(([k, l]) => `<option value="${k}" ${f.status === k ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
<label for="fq">Buscar no enunciado</label><input id="fq" name="fq" value="${esc(f.text)}"><label class="chk"><input type="checkbox" name="fr" ${f.review ? "checked" : ""}><span>Só as que precisam de revisão</span></label><div class="actions"><button class="btn sm" type="submit">Filtrar</button><a class="btn alt sm" href="#/question/new">Nova questão</a></div></form>
<div class="card scroll">${list.length ? `<table><tr><th>Enunciado</th><th>Disciplina / tema</th><th>Nível</th><th>Situação</th></tr>${list.map((q) => `<tr><td><a href="#/question/${esc(q.id)}">${esc(q.statement.slice(0, 110))}${q.statement.length > 110 ? "…" : ""}</a></td><td>${esc(q.subject_name)}<br><span class="tiny mut">${esc(q.topic_name)}</span></td><td>${esc(DIFF[q.difficulty])}</td><td><span class="pill ${q.status === "published" ? "ok" : ""}">${esc(Q_ST[q.status])}</span>${q.needs_review ? '<br><span class="pill warn">revisar</span>' : ""}</td></tr>`).join("")}</table>${more ? `<button class="btn alt sm mt" data-act="moreq">Carregar mais</button>` : ""}` : `<p class="mut">Nenhuma questão encontrada.</p>`}</div>`;
}
export function viewQuestionForm({ q, subjects, topics, msg = "" }) {
  const o = (i) => q.options[i] || { body: "", explanation: "", is_correct: false };
  const tp = topics.filter((t) => t.subject_id === q.subject_id);
  return `<p><a href="#/content/q">‹ Questões</a></p><h1>${q.id ? "Editar questão" : "Nova questão"}</h1>
<form class="card" data-form="question" novalidate>
<div class="grid g2"><div><label for="qs">Disciplina</label><select id="qs" name="qs" data-act="subjchange">${subjects.map((s) => `<option value="${esc(s.id)}" ${q.subject_id === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>
<div><label for="qt">Tema</label><select id="qt" name="qt">${tp.map((t) => `<option value="${esc(t.id)}" ${q.topic_id === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></div></div>
<div class="grid g2"><div><label for="qd">Dificuldade</label><select id="qd" name="qd">${Object.entries(DIFF).map(([k, l]) => `<option value="${k}" ${q.difficulty === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
<div><label for="qa">Situação</label><select id="qa" name="qa">${Object.entries(Q_ST).map(([k, l]) => `<option value="${k}" ${q.status === k ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
<label for="qe">Enunciado</label><textarea id="qe" name="qe" maxlength="4000">${esc(q.statement)}</textarea>
<h2 class="mt">Alternativas <span class="small mut">(marque a correta)</span></h2>
${[0, 1, 2, 3].map((i) => `<div class="optrow"><input type="radio" name="correct" value="${i}" ${o(i).is_correct ? "checked" : ""} aria-label="Alternativa ${"ABCD"[i]} é a correta"><div><label for="ob${i}" class="mb">Alternativa ${"ABCD"[i]}</label><input id="ob${i}" name="ob${i}" value="${esc(o(i).body)}" maxlength="1000"><input name="ox${i}" value="${esc(o(i).explanation || "")}" placeholder="Por que está certa/errada (opcional)" aria-label="Explicação da alternativa ${"ABCD"[i]}"></div></div>`).join("")}
<label for="qx">Explicação didática</label><textarea id="qx" name="qx">${esc(q.explanation)}</textarea>
<label for="qr">Referência bibliográfica (deixe vazio se não confirmada)</label><input id="qr" name="qr" value="${esc(q.reference_text || "")}" maxlength="500">
<label class="chk"><input type="checkbox" name="qv" ${q.needs_review ? "checked" : ""}><span>Precisa de revisão (conteúdo ainda não conferido por um professor)</span></label>
${err(msg)}<div class="actions"><button class="btn" type="submit">Salvar</button><button class="btn alt" type="button" data-act="preview">Ver prévia</button>${q.id ? `<button class="btn alt" type="button" data-act="archiveq">Arquivar</button>` : ""}</div></form><div id="preview"></div>`;
}
export function viewPreview(p) {
  return `<div class="card"><h2>Prévia (como o estudante vê)</h2><p class="mut small">${esc(p.subject)} · ${esc(p.topic)}</p><h3>${esc(p.statement)}</h3>${p.options.map((o, i) => `<div class="opt${o.correct ? " ok" : ""}"><span class="l">${"ABCD"[i]}</span><span>${esc(o.body)}${o.correct ? " ✔" : ""}</span></div>`).join("")}<div class="fb soft"><p>${esc(p.explanation)}</p></div></div>`;
}
export function viewSubjects({ subjects, topics, msg = "" }) {
  return `<h1>Conteúdo</h1>${contentTabs("s")}<div class="card scroll"><table><tr><th>Disciplina</th><th>Publicada</th><th>Disponível no teste</th><th>Temas</th></tr>${subjects.map((s) => `<tr><td><b>${esc(s.name)}</b></td><td><button class="btn alt sm" data-act="togsubj" data-id="${esc(s.id)}" data-f="is_published" role="switch" aria-checked="${s.is_published}">${s.is_published ? "Sim" : "Não"}</button></td><td><button class="btn alt sm" data-act="togsubj" data-id="${esc(s.id)}" data-f="available_in_trial" role="switch" aria-checked="${s.available_in_trial}">${s.available_in_trial ? "Liberada" : "Só assinantes"}</button></td><td>${topics.filter((t) => t.subject_id === s.id).length}</td></tr>`).join("")}</table></div>
<form class="card" data-form="newsubject" novalidate><h2>Nova disciplina</h2><label for="sn" class="mb">Nome</label><input id="sn" name="sn" maxlength="80"><label for="sd">Descrição</label><input id="sd" name="sd" maxlength="200"><div class="err" role="alert">${esc(msg)}</div><button class="btn" type="submit">Criar disciplina</button></form>
<form class="card" data-form="newtopic" novalidate><h2>Novo tema</h2><label for="ts" class="mb">Disciplina</label><select id="ts" name="ts">${subjects.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select><label for="tn">Nome do tema</label><input id="tn" name="tn" maxlength="80"><div class="err" role="alert"></div><button class="btn" type="submit">Criar tema</button></form>`;
}
export function viewFlags(list) {
  return `<h1>Conteúdo</h1>${contentTabs("f")}${list.length ? list.map((f) => `<div class="card"><p class="small mut">${esc(f.students?.full_name || "Estudante")} · ${esc(dt(f.created_at))}</p><p><b>${esc((f.questions?.statement || "").slice(0, 160))}</b></p><p>${esc(f.reason)}</p><div class="actions"><a class="btn alt sm" href="#/question/${esc(f.question_id)}">Abrir questão</a><button class="btn sm" data-act="flagdone" data-id="${esc(f.id)}" data-s="reviewed">Marcar como revisada</button><button class="btn alt sm" data-act="flagdone" data-id="${esc(f.id)}" data-s="dismissed">Dispensar</button></div></div>`).join("") : `<div class="card mut">Nenhum aviso de erro aberto.</div>`}`;
}
export function viewIO({ msg = "", report = null }) {
  return `<h1>Conteúdo</h1>${contentTabs("io")}<div class="card"><h2>Exportar</h2><p class="mut small">Baixa todas as questões (com alternativas) em um arquivo JSON, útil como cópia de segurança.</p><button class="btn" data-act="export">Exportar questões (JSON)</button></div>
<div class="card"><h2>Importar</h2><p class="mut small">Envie um arquivo JSON no mesmo formato da exportação. Nada é gravado antes da validação; as questões entram como <b>rascunho</b>.</p><input type="file" id="file" accept="application/json,.json" aria-label="Arquivo JSON">
${report ? `<div class="fb ${report.errors.length ? "bad" : "ok"} mt" role="status"><p><b>${report.valid.length}</b> questão(ões) válida(s), <b>${report.errors.length}</b> com problema.</p>${report.errors.length ? `<ul class="clean">${report.errors.slice(0, 15).map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}${report.valid.length ? `<button class="btn mt" data-act="doimport">Importar ${report.valid.length} como rascunho</button>` : ""}</div>` : ""}${err(msg)}</div>`;
}

// ---------- configurações e auditoria ----------
export const SETTINGS = [
  ["platform_name", "Nome da plataforma", "text"], ["trial_days", "Duração do período de teste (dias)", "number"], ["session_ttl_days", "Validade da sessão no aparelho (dias)", "number"],
  ["welcome_message", "Mensagem de boas-vindas", "text"], ["expiry_warning_days", "Avisar quando faltarem (dias)", "number"], ["expiry_warning_message", "Aviso de vencimento próximo", "text"],
  ["expired_message", "Mensagem de acesso vencido", "text"], ["terms_version", "Versão dos termos (mude ao atualizá-los)", "text"], ["maintenance_mode", "Modo manutenção (bloqueia o app dos estudantes)", "bool"],
];
export function viewSettings({ values, msg = "" }) {
  return `<h1>Configurações</h1><div class="fb info small">As mudanças valem para novos cadastros e para as próximas telas dos estudantes. Só o perfil “owner” pode alterar.</div>
${SETTINGS.map(([k, l, t]) => `<form class="card" data-form="setting" data-key="${k}" novalidate><label for="s_${k}" class="mb">${esc(l)}</label>${t === "bool" ? `<select id="s_${k}" name="v"><option value="false" ${values[k] ? "" : "selected"}>Desligado</option><option value="true" ${values[k] ? "selected" : ""}>Ligado</option></select>` : `<input id="s_${k}" name="v" ${t === "number" ? 'type="number" min="0"' : ""} value="${esc(values[k] ?? "")}" maxlength="300">`}<div class="err" role="alert"></div><button class="btn sm" type="submit">Salvar</button></form>`).join("")}${err(msg)}`;
}
export function viewAudit(list) {
  return `<h1>Auditoria</h1><div class="card scroll"><table><tr><th>Quando</th><th>Quem</th><th>Ação</th></tr>${list.map((a) => `<tr><td>${esc(dt(a.created_at))}</td><td>${a.actor_type === "admin" ? "Administrador" : a.actor_type === "student" ? "Estudante" : "Sistema"}</td><td>${esc(ACTION[a.action] || a.action)}</td></tr>`).join("")}</table></div><p class="tiny mut">Últimos 100 registros. Os registros não podem ser editados nem apagados.</p>`;
}
