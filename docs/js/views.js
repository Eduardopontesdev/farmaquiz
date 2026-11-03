// Telas (funções puras: dados -> HTML). Nada aqui acessa a rede ou o DOM.
import { esc, avatarHtml, AVATARS, money, dateBR, pct, daysLeft, remainingText, accessLabel, mmss } from "./ui.js";

export const viewLoading = () => `<div class="center"><div class="spin" role="status" aria-label="Carregando"></div><p class="mut">Carregando…</p></div>`;
export const viewFatal = (msg, retry = true) => `<div class="card"><h1>Ops!</h1><p>${esc(msg)}</p>${retry ? `<button class="btn" data-act="retry">Tentar novamente</button>` : ""}</div>`;
export const viewSuspended = () => `<div class="card"><h1>Conta suspensa</h1><p>Sua conta está suspensa no momento. Fale com o administrador do FarmaQuiz para saber mais.</p><button class="btn alt" data-act="logout">Sair</button></div>`;

// ---------- entrada ----------
export const viewSignup = (err = "") => `<h1>Aprenda Farmácia, uma questão de cada vez.</h1>
<p class="mut">Cadastre-se e comece seu período de teste gratuito.</p>
<form class="card" data-form="signup" novalidate>
  <label for="nm">Nome completo</label><input id="nm" name="nm" autocomplete="name" maxlength="120" required>
  <label for="ph">Telefone com DDD</label><input id="ph" name="ph" inputmode="tel" autocomplete="tel" placeholder="(88) 99999-0000" required>
  <label class="chk"><input type="checkbox" id="tm" name="tm"><span>Li e aceito os <a href="termos.html" target="_blank" rel="noopener">termos de uso</a> e a <a href="privacidade.html" target="_blank" rel="noopener">política de privacidade</a>. Entendo que meu telefone não comprova minha identidade.</span></label>
  <div class="err" role="alert">${esc(err)}</div>
  <button class="btn" type="submit">Começar período de teste</button>
</form>
<p class="small mut">Já usa o FarmaQuiz e trocou de aparelho? <a href="#/recover">Recuperar meu acesso</a></p>`;

export const viewRecover = (err = "") => `<h1>Recuperar acesso</h1>
<p class="mut">Peça ao administrador um código de recuperação e informe-o abaixo, junto com o telefone do seu cadastro.</p>
<form class="card" data-form="recover" novalidate>
  <label for="ph">Telefone cadastrado</label><input id="ph" name="ph" inputmode="tel" autocomplete="tel" placeholder="(88) 99999-0000" required>
  <label for="rc">Código de recuperação</label><input id="rc" name="rc" autocapitalize="characters" autocomplete="off" placeholder="RC-XXXXXX-XXXXXX" required>
  <div class="err" role="alert">${esc(err)}</div>
  <button class="btn" type="submit">Recuperar acesso</button>
</form>
<p class="small"><a href="#/signup">Voltar ao cadastro</a></p>`;

// ---------- início ----------
export function viewHome({ me, stats, news, settings }) {
  const first = esc((me.full_name || "").split(" ")[0]);
  const a = me.access, warnDays = Number(settings?.expiry_warning_days ?? 3), dl = daysLeft(a);
  const warn = a.state === "licensed" && dl != null && dl <= warnDays
    ? `<div class="fb bad" role="status">${esc(settings?.expiry_warning_message || "Seu acesso termina em breve.")} <a href="#/profile">Renovar</a></div>` : "";
  const trial = a.state === "trial" ? `<div class="fb info" role="status"><b>Período de teste ativo.</b> Restam ${esc(remainingText(a))}. No teste, apenas as disciplinas liberadas estão disponíveis. <a href="#/profile">Ver assinatura</a></div>` : "";
  const nw = news && news.unread > 0 ? `<div class="fb ok" role="status"><b>Novidade:</b> ${esc(news.items[0].title)}<br><a href="#/news">Ver novidades</a></div>` : "";
  return `<h1 class="row">${avatarHtml(me.avatar_id, me.full_name, "md")}<span>Olá, ${first}!</span></h1>
<p class="mut">${esc(settings?.welcome_message || "Bem-vindo(a) ao FarmaQuiz.")}</p>${warn}${trial}${nw}
<div class="stats"><div class="stat"><b>${stats.answered}</b><span>respondidas</span></div><div class="stat"><b>${pct(stats.correct, stats.answered)}</b><span>de acertos</span></div><div class="stat"><b>${stats.streak_days}</b><span>dias seguidos</span></div></div>
<div class="grid g2 mb"><button class="btn" data-act="continue">Continuar estudando</button><a class="btn alt" href="#/subjects">Escolher disciplina</a><a class="btn alt" href="#/simulado">Fazer simulado</a><button class="btn alt" data-act="review" ${stats.wrong_count ? "" : "disabled"}>Revisar erros${stats.wrong_count ? ` (${stats.wrong_count})` : ""}</button></div>
<a class="btn alt" href="#/stats">Ver meu desempenho</a>`;
}

// ---------- disciplinas e simulado ----------
export function viewSubjects(subjects, trial) {
  if (!subjects.length) return `<h1>Disciplinas</h1><div class="card"><p>Ainda não há disciplinas publicadas. Volte em breve!</p></div>`;
  return `<h1>Disciplinas</h1>${trial ? `<div class="fb info">No período de teste, só as disciplinas sem cadeado estão liberadas. As demais abrem com a assinatura.</div>` : ""}` +
    subjects.map((s) => s.locked
      ? `<a class="card subj" href="#/profile"><span><b>${esc(s.name)}</b><br><span class="lock">🔒 Disponível com a assinatura</span></span><span aria-hidden="true">›</span></a>`
      : `<a class="card subj" href="#/subject/${esc(s.id)}"><span><b>${esc(s.name)}</b><br><span class="mut small">${esc(s.description || "")}</span><br><span class="tiny mut">${s.question_count} questões</span></span><span aria-hidden="true">›</span></a>`).join("");
}
export function viewSubject(s) {
  if (!s) return viewFatal("Disciplina não encontrada.", false);
  return `<h1>${esc(s.name)}</h1><p class="mut">${esc(s.description || "")}</p>
<label for="cnt">Quantas questões nesta sessão?</label><select id="cnt"><option>5</option><option selected>10</option><option>20</option></select>
<div class="grid mt"><button class="btn" data-act="start" data-subject="${esc(s.id)}">Todas as questões da disciplina</button></div>
${s.topics.length ? `<h2 class="mt">Ou escolha um tema</h2><div class="grid">${s.topics.map((t) => `<button class="btn alt" data-act="start" data-subject="${esc(s.id)}" data-topic="${esc(t.id)}">${esc(t.name)}</button>`).join("")}</div>` : ""}
<p class="mt"><a href="#/subjects">‹ Voltar às disciplinas</a></p>`;
}
export function viewSimulado(subjects) {
  const ok = subjects.filter((s) => !s.locked);
  if (!ok.length) return `<h1>Simulado</h1><div class="card"><p>Não há disciplinas disponíveis para simulado agora.</p></div>`;
  return `<h1>Simulado</h1><p class="mut">Questões em ordem aleatória. O gabarito aparece só ao finalizar.</p>
<form class="card" data-form="simulado" novalidate>
  <label for="sj">Disciplina</label><select id="sj" name="sj"><option value="">Todas as disponíveis (variado)</option>${ok.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select>
  <label for="ct">Número de questões</label><select id="ct" name="ct"><option>10</option><option selected>20</option><option>30</option><option>50</option></select>
  <label class="chk"><input type="checkbox" id="tm" name="tm"><span>Usar cronômetro</span></label>
  <label for="mn">Tempo total (minutos)</label><input id="mn" name="mn" type="number" min="1" max="300" value="30" inputmode="numeric">
  <div class="err" role="alert"></div>
  <button class="btn" type="submit">Iniciar simulado</button>
</form>`;
}

// ---------- questão ----------
export function viewQuiz(Z) {
  const q = Z.q, revealed = !!(q.answered && q.result), sim = Z.mode === "simulado", last = q.index + 1 >= q.total;
  const opts = q.options.map((o) => {
    let cls = "";
    if (revealed) { if (o.is_correct) cls = " ok"; else if (o.id === q.selected_option_id) cls = " bad"; }
    else if (q.answered ? o.id === q.selected_option_id : o.id === Z.sel) cls = " sel";
    const pressed = q.answered ? o.id === q.selected_option_id : o.id === Z.sel;
    return `<button class="opt${cls}" data-act="opt" data-id="${esc(o.id)}" aria-pressed="${pressed}" ${q.answered ? "disabled" : ""}><span class="l">${esc(o.label)}</span><span>${esc(o.body)}${revealed && o.explanation ? `<span class="optx">${esc(o.explanation)}</span>` : ""}</span></button>`;
  }).join("");
  const fb = revealed
    ? `<div class="fb ${q.result.is_correct ? "ok" : "bad"}" role="status"><p><b>${q.result.is_correct ? "Resposta correta!" : "Resposta incorreta."}</b></p><p>${esc(q.result.explanation)}</p>${q.result.reference ? `<p class="tiny">Referência: ${esc(q.result.reference)}</p>` : ""}</div>`
    : q.answered ? `<div class="fb info" role="status">Resposta registrada. O gabarito aparece ao finalizar o simulado.</div>` : "";
  const action = q.answered
    ? `<button class="btn" data-act="next">${last ? "Finalizar" : "Próxima questão"}</button>`
    : `<button class="btn" data-act="confirm" ${Z.sel ? "" : "disabled"}>Confirmar resposta</button>`;
  const flag = Z.flag ? `<form class="card" data-form="flag"><label for="fr">O que parece errado nesta questão?</label><textarea id="fr" name="fr" maxlength="1000" required></textarea><div class="err" role="alert"></div><div class="grid g2"><button class="btn" type="submit">Enviar aviso</button><button class="btn alt" type="button" data-act="flagOpen">Cancelar</button></div></form>` : "";
  return `<p class="mut small">${esc(q.subject)} · ${esc(q.topic)}</p><p class="qn">Questão ${q.index + 1} de ${q.total}</p>
${Z.secs != null ? `<p class="timer" id="timer" role="timer">Tempo restante: ${mmss(Z.secs)}</p>` : ""}
<progress max="${q.total}" value="${q.index + (q.answered ? 1 : 0)}" aria-label="Progresso da sessão"></progress>
<div class="card"><h2>${esc(q.statement)}</h2></div>${opts}${fb}${action}
<div class="grid g2 mt"><button class="btn alt sm" data-act="fav" aria-pressed="${q.is_favorite}">${q.is_favorite ? "★ Favorita" : "☆ Favoritar"}</button><button class="btn alt sm" data-act="flagOpen">Sinalizar possível erro</button></div>${flag}
<p class="mt small"><a href="#/home">Sair e continuar depois</a> <span class="mut">(seu progresso fica salvo)</span></p>`;
}

export function viewResult(r) {
  const wrong = r.wrong_questions || [];
  return `<h1>${r.mode === "simulado" ? "Simulado concluído" : "Sessão concluída"}</h1>
<div class="stats"><div class="stat"><b>${r.answered}</b><span>respondidas</span></div><div class="stat"><b>${r.correct}</b><span>acertos</span></div><div class="stat"><b>${r.percent == null ? "—" : r.percent + "%"}</b><span>aproveitamento</span></div></div>
<p class="small mut">Erros: ${r.wrong}${r.unanswered ? ` · Sem resposta: ${r.unanswered}` : ""}</p>
${wrong.length ? `<div class="card"><h2>Questões erradas</h2><ul class="clean">${wrong.map((w) => `<li>${esc(w.statement)}</li>`).join("")}</ul></div>` : `<div class="fb ok">Você não errou nenhuma questão respondida. Ótimo trabalho!</div>`}
<div class="grid g2 mb">${wrong.length ? `<button class="btn" data-act="review">Refazer os erros</button>` : ""}<a class="btn alt" href="#/review/${esc(r.session_id)}">Ver revisão completa</a><a class="btn alt" href="#/subjects">Nova sessão</a><a class="btn alt" href="#/home">Início</a></div>`;
}
export function viewReview(items) {
  return `<h1>Revisão</h1>` + items.map((q) => `<div class="card"><p class="mut small">Questão ${q.index + 1} · ${esc(q.subject)} · ${esc(q.topic)}</p><h2>${esc(q.statement)}</h2>
${q.options.map((o) => {
    const mine = o.id === q.selected_option_id;
    const tag = o.is_correct ? " ✔ correta" : mine ? " ✘ sua resposta" : "";
    return `<div class="opt${o.is_correct ? " ok" : mine ? " bad" : ""}"><span class="l">${esc(o.label)}</span><span>${esc(o.body)}<b>${tag}</b>${o.explanation ? `<span class="optx">${esc(o.explanation)}</span>` : ""}</span></div>`;
  }).join("")}
${q.result ? `<div class="fb soft"><p>${esc(q.result.explanation)}</p></div>` : `<div class="fb soft">Esta questão não foi respondida.</div>`}</div>`).join("") + `<a class="btn alt" href="#/home">Voltar ao início</a>`;
}

// ---------- ranking, novidades, desempenho ----------
export function viewRanking(d, period) {
  const t = (p, l) => `<button class="btn ${period === p ? "" : "alt"}" data-act="period" data-p="${p}">${l}</button>`;
  const me = d.me;
  const sum = me.visible ? (me.position ? `<b>Você está em ${me.position}º lugar</b> com ${me.points} pontos.` : `Você tem ${me.points} pontos. Acerte questões para entrar no ranking.`) : `Você está oculto(a) do ranking. Para aparecer, ative a opção em <a href="#/profile">Perfil</a>.`;
  return `<h1>Ranking</h1><p class="mut">Cada questão diferente acertada vale 10 pontos. O ranking mostra só o primeiro nome e o avatar.</p>
<div class="tabs2">${t("all", "Geral")}${t("week", "Esta semana")}</div><div class="card">${sum}</div>
${d.top.length ? `<div class="card">${d.top.map((r) => `<div class="rk${r.is_me ? " me" : ""}"><span class="ps">${r.position}º</span>${avatarHtml(r.avatar_id, r.first_name, "sm")}<span class="nm">${esc(r.first_name)}${r.is_me ? " (você)" : ""}</span><b>${r.points}</b></div>`).join("")}</div>` : `<div class="card mut">Ninguém pontuou ainda neste período. Seja o primeiro!</div>`}`;
}
export function viewNews(d) {
  return `<h1>Novidades</h1><p class="mut">Avisos sobre matérias, recursos e melhorias do FarmaQuiz.</p>` +
    (d.items.length ? d.items.map((n) => `<div class="card"><h2>${esc(n.title)}${n.is_new ? ` <span class="chip warn">novo</span>` : ""}</h2><p>${esc(n.body)}</p><p class="tiny mut">${esc(dateBR(n.published_at))}</p></div>`).join("") : `<div class="card mut">Nenhuma novidade por enquanto.</div>`);
}
export function viewStats(s) {
  const bar = (name, n, ok) => `<div class="barrow"><span>${esc(name)}</span><b>${pct(ok, n)}</b><progress max="100" value="${n ? Math.round((100 * ok) / n) : 0}" aria-label="${esc(name)}"></progress></div>`;
  const topics = (arr) => arr.length ? `<ul class="clean">${arr.map((t) => `<li>${esc(t.topic)} <span class="mut">(${esc(t.subject)}) · ${t.percent}% em ${t.answered}</span></li>`).join("")}</ul>` : `<p class="mut small">Responda ao menos 3 questões por tema para ver esta análise.</p>`;
  const modes = { study: "Estudo", simulado: "Simulado", review: "Revisão" };
  return `<h1>Meu desempenho</h1>
<div class="stats"><div class="stat"><b>${s.answered}</b><span>respondidas</span></div><div class="stat"><b>${pct(s.correct, s.answered)}</b><span>de acertos</span></div><div class="stat"><b>${s.streak_days}</b><span>dias seguidos</span></div></div>
<div class="card"><h2>Por disciplina</h2>${s.by_subject.length ? s.by_subject.map((x) => bar(x.subject, x.answered, x.correct)).join("") : `<p class="mut small">Você ainda não respondeu questões.</p>`}</div>
<div class="card"><h2>Temas com melhor desempenho</h2>${topics(s.best_topics)}</div>
<div class="card"><h2>Temas para revisar</h2>${topics(s.review_topics)}</div>
<div class="card"><h2>Últimas sessões</h2>${s.recent_sessions.length ? `<ul class="clean">${s.recent_sessions.map((x) => `<li><a href="#/review/${esc(x.session_id)}">${modes[x.mode] || "Sessão"} · ${esc(dateBR(x.finished_at))}</a> — ${x.correct}/${x.total}</li>`).join("")}</ul>` : `<p class="mut small">Nenhuma sessão concluída ainda.</p>`}</div>
<p class="small mut">Questões favoritas: ${s.favorites_count} · Questões para revisar: ${s.wrong_count}</p><a class="btn alt" href="#/home">Voltar</a>`;
}

// ---------- perfil e assinatura ----------
export function subscriptionCard({ me, sub, plans, expired }) {
  const a = me.access, dl = daysLeft(a);
  const planBtns = `<div class="grid g2">${plans.map((p) => `<button class="btn alt plan" data-act="plan" data-plan="${esc(p.code)}"><b>${money(p.price_cents)}</b><span>${esc(p.name)}</span></button>`).join("")}</div>`;
  const intro = `<p class="mut small">Pagamento via Pix. O valor é usado em melhorias e atualizações do FarmaQuiz, e a cada semestre novas matérias são incluídas.</p>`;
  const notice = sub.pix_notice ? `<div class="fb ok" role="status"><p><b>Nova chave Pix recebida.</b> O administrador enviou os dados atualizados; use a chave abaixo.</p><button class="btn alt sm" data-act="ackpix">Entendi</button></div>` : "";
  if (!sub.request) {
    if (a.state === "licensed" && dl != null && dl > 7) return `<div class="card"><h2>Assinatura</h2><p>Sua licença está ativa até <b>${esc(dateBR(a.ends_at))}</b>.</p></div>`;
    return `<div class="card"><h2>${a.state === "licensed" ? "Renovar assinatura" : "Assinatura"}</h2>${intro}${planBtns}${plans.length ? "" : `<p class="mut">Nenhum plano disponível agora.</p>`}</div>`;
  }
  const r = sub.request, pix = sub.pix;
  const pixBox = pix && pix.key
    ? `<div class="fb soft"><p class="tiny mut">Dados do Pix</p><p>Recebedor: <b>${esc(pix.receiver_name)}</b><br>Banco: <b>${esc(pix.bank)}</b><br>Chave: <b>${esc(pix.key)}</b></p><div class="grid g2"><button class="btn alt sm" data-act="copypix">Copiar chave</button><button class="btn alt sm" data-act="pixbad" ${sub.pix_problem_reported ? "disabled" : ""}>A chave Pix não está funcionando</button></div>${sub.pix_problem_reported ? `<p class="small mt">Aviso enviado ao administrador. Você receberá a nova chave aqui.</p>` : ""}</div>`
    : `<div class="fb info">O administrador ainda não cadastrou a chave Pix. Tente novamente em instantes.</div>`;
  const step2 = r.status === "pending" ? `<button class="btn" data-act="paid">Pagamento concluído</button>` : r.status === "payment_reported" ? `<div class="fb ok" role="status">Aviso de pagamento enviado ao administrador. Aguarde a liberação do código.</div>` : "";
  const step3 = sub.code_ready ? `<div class="fb ok" role="status"><p><b>Seu código chegou!</b> O administrador confirmou seu pagamento. Toque em ativar para liberar seu acesso.</p></div><button class="btn" data-act="activate">Ativar meu acesso</button>`
    : r.status === "code_sent" ? `<div class="fb bad" role="alert">Este código foi cancelado. Fale com o administrador.</div>` : `<p class="mut small">Seu código aparecerá aqui assim que o administrador confirmar o pagamento.</p>`;
  const manual = expired ? "" : `<details><summary>Recebeu um código por outro meio?</summary>${redeemForm("Ativar com este código")}</details>`;
  return `<div class="card"><h2>Plano de ${esc(r.plan_name)} · ${money(r.price_cents)}</h2>${notice}<h3>1. Pague via Pix</h3>${pixBox}<h3>2. Avise que pagou</h3>${step2}<h3 class="mt">3. Ative seu acesso</h3>${step3}${manual}</div>`;
}
const redeemForm = (label) => `<form data-form="redeem" novalidate><label for="cd">Código de acesso</label><input id="cd" name="code" autocapitalize="characters" autocomplete="off" placeholder="FQ-XXXXX-XXXXX"><div class="err" role="alert"></div><button class="btn" type="submit">${esc(label)}</button></form>`;

export function viewProfile({ me, sub, plans }) {
  return `<h1>Perfil</h1>
<div class="card row">${avatarHtml(me.avatar_id, me.full_name, "lg")}<div><b>${esc(me.full_name)}</b><br><span class="mut small">${esc(accessLabel(me.access))}</span></div></div>
${subscriptionCard({ me, sub, plans, expired: false })}
<form class="card" data-form="name" novalidate><h2>Nome</h2><label for="pn">Nome completo</label><input id="pn" name="pn" value="${esc(me.full_name)}" autocomplete="name" maxlength="60"><div class="err" role="alert"></div><button class="btn" type="submit">Salvar nome</button><p class="tiny mut mt">O telefone não pode ser alterado aqui. Para trocá-lo, fale com o administrador.</p></form>
<div class="card"><h2>Avatar</h2><p class="mut small">O padrão usa suas iniciais. Ou escolha um bichinho.</p><div class="avs"><button class="btn alt" data-act="avatar" data-id="" aria-pressed="${me.avatar_id == null}" aria-label="Iniciais (padrão)">${avatarHtml(null, me.full_name, "md")}</button>${AVATARS.map((a, i) => `<button class="btn alt" data-act="avatar" data-id="${i}" aria-pressed="${me.avatar_id === i}" aria-label="${esc(a[1])}">${a[0]}</button>`).join("")}</div></div>
<div class="card"><button class="btn alt" data-act="toggleRank" role="switch" aria-checked="${me.show_in_ranking}">Aparecer no ranking: <b>${me.show_in_ranking ? "ativado" : "desativado"}</b></button><p class="tiny mut mt">Outros estudantes veem só seu primeiro nome e avatar.</p></div>
<div class="grid g2"><a class="btn alt" href="termos.html" target="_blank" rel="noopener">Termos de uso</a><a class="btn alt" href="privacidade.html" target="_blank" rel="noopener">Privacidade</a></div>
<button class="btn alt mt" data-act="logout">Sair deste aparelho</button>`;
}
export function viewExpired({ me, sub, plans, settings }) {
  return `<h1>${esc(settings?.expired_message || "Seu período de acesso terminou.")}</h1>
<p class="mut">Para continuar estudando no FarmaQuiz, informe o código de acesso fornecido pelo administrador.</p>
<div class="card">${redeemForm("Ativar meu acesso")}<p class="small mut mt">Ainda não recebeu um código? Assine abaixo ou fale com o administrador.</p></div>
${subscriptionCard({ me, sub, plans, expired: true })}
<div class="grid g2"><a class="btn alt" href="#/profile">Meu perfil</a><button class="btn alt" data-act="logout">Sair</button></div>`;
}
export function tabsHtml(active, unread, me) {
  const items = [["home", "🏠", "Início"], ["subjects", "📚", "Estudar"], ["ranking", "🏆", "Ranking"], ["news", "🔔", "Novidades"], ["profile", "🙂", "Perfil"]];
  return items.map(([k, ic, l]) => `<a href="#/${k}" ${active === k ? 'aria-current="page"' : ""}><span class="ic" aria-hidden="true">${k === "profile" && me ? (Number.isInteger(me.avatar_id) && AVATARS[me.avatar_id] ? AVATARS[me.avatar_id][0] : ic) : ic}</span><span>${l}${k === "news" && unread > 0 ? `<span class="badge" aria-label="${unread} não lidas">${unread}</span>` : ""}</span></a>`).join("");
}
