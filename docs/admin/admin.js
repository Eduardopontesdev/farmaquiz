// FarmaQuiz | painel administrativo. Toda permissão é conferida pelo banco (RLS + funções admin_*);
// esconder um botão aqui é só conforto, nunca é a proteção.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import * as V from "./views.js";

const cfg = window.FARMAQUIZ || {};
const root = document.getElementById("root"), toastEl = document.getElementById("toast");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RANK = { editor: 1, admin: 2, owner: 3 };
const NAV = [["dash", "Painel", 2], ["subs", "Assinaturas", 2], ["pix", "Chave Pix", 2], ["students", "Estudantes", 2], ["codes", "Códigos", 2], ["news", "Novidades", 1], ["content", "Conteúdo", 1], ["audit", "Auditoria", 2], ["settings", "Configurações", 3]];
const ROUTE_MIN = { dash: 2, subs: 2, pix: 2, students: 2, student: 2, codes: 2, news: 1, content: 1, question: 1, audit: 2, settings: 3 };
const A = { sb: null, role: null, name: "", busy: false, search: "", codeFilter: "", created: [], eph: {}, qf: { subject: "", status: "", text: "", review: false }, qlist: [], qpage: 0, qmore: false, subjects: [], topics: [], imp: null, qid: null, qcur: null };

const toast = (m) => { toastEl.textContent = m; toastEl.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove("show"), 5000); };
const paint = (h) => { root.innerHTML = h; };
const setErr = (f, m) => { const e = f && f.querySelector && f.querySelector(".err"); if (e) e.textContent = m; else toast(m); };
const slug = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || /SEU-PROJETO|COLE-AQUI/.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY)) {
  paint(`<div class="wrap"><div class="card"><h1>Falta configurar</h1><p>Edite o arquivo <b>config.js</b> (na pasta principal do site) com o endereço do Supabase e a chave <i>anon public</i>.</p></div></div>`);
} else {
  A.sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  start();
}

// ---------- acesso a dados ----------
function friendly(e) {
  const m = (e && e.message) || "";
  const map = { forbidden: "Você não tem permissão para esta ação.", not_found: "Item não encontrado.", invalid_status: "Esta solicitação já foi tratada.",
    pix_not_updated_or_not_found: "Troque a chave Pix antes de enviar a nova chave.", invalid_pix_data: "Preencha recebedor, banco e uma chave válida.",
    only_available_codes_can_be_revoked: "Só códigos ainda disponíveis podem ser revogados.", student_not_found: "Estudante não encontrado.",
    invalid_duration: "Duração inválida (1 a 3650 dias).", invalid_count: "Quantidade inválida (1 a 50).", invalid_redeem_by: "O prazo de resgate precisa ser uma data futura.",
    license_not_found: "Licença não encontrada ou já encerrada.", unknown_setting: "Configuração desconhecida." };
  if (map[m]) return new Error(map[m]);
  if (e && e.code === "23505") return new Error("Já existe um item com estes dados.");
  if (e && e.code === "42501") return new Error("Você não tem permissão para esta ação.");
  if (/Despublique|publicada|alternativas/.test(m)) return new Error(m);
  console.error(e); return new Error("Não foi possível concluir: " + (m || "erro desconhecido"));
}
async function rpc(fn, args = {}) { const { data, error } = await A.sb.rpc(fn, args); if (error) throw friendly(error); return data; }
async function tbl(builder) { const { data, error } = await builder; if (error) throw friendly(error); return data; }

// ---------- início e login ----------
async function start() {
  A.sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") { A.role = null; paint(V.viewLogin()); } });
  const { data: { session } } = await A.sb.auth.getSession();
  if (!session) return paint(V.viewLogin());
  const { data: p, error } = await A.sb.from("admin_profiles").select("display_name,role,is_active").eq("user_id", session.user.id).maybeSingle();
  if (error || !p || !p.is_active) return paint(V.viewNoPerm());
  A.role = p.role; A.name = p.display_name;
  window.addEventListener("hashchange", route); route();
}

// ---------- rotas ----------
const screens = {};
const shell = (active, body) => paint(V.viewShell({ active, items: NAV.filter((n) => RANK[A.role] >= n[2]).map((n) => [n[0], n[1]]), name: A.name, role: A.role, body }));
async function route() {
  if (!A.role) return;
  const [name, arg, arg2] = location.hash.replace(/^#\/?/, "").split("/");
  const def = RANK[A.role] >= 2 ? "dash" : "content";
  const r = ROUTE_MIN[name] ? name : def;
  if (RANK[A.role] < ROUTE_MIN[r]) { location.hash = "#/" + def; return; }
  if (name !== "student") A.eph = {};
  shell({ student: "students", question: "content" }[r] || r, `<div class="center"><div class="spin" role="status" aria-label="Carregando"></div></div>`);
  try { await screens[r](arg, arg2); }
  catch (e) { shell(r, `<div class="card"><h1>Ops!</h1><p id="errmsg"></p><button class="btn" data-act="retry">Tentar novamente</button></div>`); document.getElementById("errmsg").textContent = e.message; }
}
const rerender = () => route();
const body = (active, html) => shell(active, html);

screens.dash = async () => {
  const [stats, subs, alerts] = await Promise.all([rpc("admin_dashboard_stats"), rpc("admin_list_subscription_requests"), rpc("admin_list_pix_alerts")]);
  body("dash", V.viewDash({ stats, pays: subs.filter((s) => s.status === "payment_reported").length, alerts: alerts.filter((a) => a.status === "open").length }));
};
screens.subs = async () => body("subs", V.viewSubs(await rpc("admin_list_subscription_requests")));
screens.pix = async (_a, _b, msg = "") => body("pix", V.viewPix({ pix: await rpc("admin_get_pix"), alerts: await rpc("admin_list_pix_alerts"), msg }));
screens.students = async () => body("students", V.viewStudents({ list: await rpc("admin_list_students", { p_search: A.search || null, p_limit: 100, p_offset: 0 }) , search: A.search }));
screens.student = async (id) => {
  if (!UUID.test(id || "")) return (location.hash = "#/students");
  const d = await rpc("admin_get_student", { p_student: id });
  if (!d) return body("students", `<div class="card"><p>Estudante não encontrado.</p></div>`);
  const audit = await tbl(A.sb.from("audit_logs").select("action,created_at").or(`actor_student_id.eq.${id},entity_id.eq.${id}`).order("id", { ascending: false }).limit(30));
  A.sid = id; body("students", V.viewStudent({ d, audit, newToken: A.eph.token, newCode: A.eph.code }));
};
screens.codes = async () => body("codes", V.viewCodes({ list: await rpc("admin_list_access_codes", { p_status: A.codeFilter || null, p_limit: 100, p_offset: 0 }), status: A.codeFilter, created: A.created }));
screens.news = async (_a, _b, msg = "") => body("news", V.viewNews({ items: await tbl(A.sb.from("announcements").select("id,title,body,is_active,created_at").order("created_at", { ascending: false }).limit(50)), msg }));
screens.audit = async () => body("audit", V.viewAudit(await tbl(A.sb.from("audit_logs").select("action,actor_type,created_at").order("id", { ascending: false }).limit(100))));
screens.settings = async () => {
  const rows = await tbl(A.sb.from("platform_settings").select("key,value")); const values = {}; rows.forEach((r) => (values[r.key] = r.value));
  body("settings", V.viewSettings({ values }));
};

async function loadRef() {
  A.subjects = await tbl(A.sb.from("subjects").select("id,slug,name,description,sort_order,is_published,available_in_trial").order("sort_order"));
  A.topics = await tbl(A.sb.from("topics").select("id,subject_id,slug,name,sort_order").order("sort_order"));
}
async function fetchQuestions(reset) {
  if (reset) { A.qpage = 0; A.qlist = []; }
  const f = A.qf, per = 50;
  let qb = A.sb.from("questions").select("id,statement,difficulty,status,needs_review,subject_id,topic_id,subjects(name)").order("created_at", { ascending: false }).range(A.qpage * per, A.qpage * per + per - 1);
  if (f.subject) qb = qb.eq("subject_id", f.subject);
  if (f.status) qb = qb.eq("status", f.status);
  if (f.review) qb = qb.eq("needs_review", true);
  if (f.text.trim()) qb = qb.ilike("statement", `%${f.text.trim().replace(/[%]/g, "")}%`);
  const rows = await tbl(qb); const tn = Object.fromEntries(A.topics.map((t) => [t.id, t.name]));
  A.qlist = A.qlist.concat(rows.map((q) => ({ ...q, subject_name: q.subjects?.name || "", topic_name: tn[q.topic_id] || "" }))); A.qmore = rows.length === per;
}
screens.content = async (tab) => {
  await loadRef();
  if (tab === "s") return body("content", V.viewSubjects({ subjects: A.subjects, topics: A.topics }));
  if (tab === "f") {
    const list = await tbl(A.sb.from("question_flags").select("id,reason,created_at,question_id,questions(statement),students(full_name)").eq("status", "open").order("created_at"));
    return body("content", V.viewFlags(list));
  }
  if (tab === "io") return body("content", V.viewIO({ report: A.imp }));
  await fetchQuestions(true); body("content", V.viewQuestions({ list: A.qlist, subjects: A.subjects, f: A.qf, more: A.qmore }));
};
screens.question = async (id) => {
  await loadRef(); A.qid = null; A.qcur = null;
  let q;
  if (id === "new") q = { subject_id: A.subjects[0]?.id, topic_id: A.topics.find((t) => t.subject_id === A.subjects[0]?.id)?.id, difficulty: "medio", status: "draft", statement: "", explanation: "", reference_text: "", needs_review: true, options: [] };
  else {
    if (!UUID.test(id || "")) return (location.hash = "#/content/q");
    const d = await tbl(A.sb.from("questions").select("*, question_options(*)").eq("id", id).maybeSingle());
    if (!d) return body("content", `<div class="card"><p>Questão não encontrada.</p></div>`);
    q = { ...d, options: [...d.question_options].sort((a, b) => a.label.localeCompare(b.label)) }; A.qid = id; A.qcur = q;
  }
  body("content", V.viewQuestionForm({ q, subjects: A.subjects, topics: A.topics }));
};

// ---------- ações ----------
const confirmAnd = (msg, fn) => (confirm(msg) ? fn() : null);
const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast("Copiado."); } catch { toast("Não foi possível copiar. Selecione e copie manualmente."); } };
const daysFrom = (f, sel, other) => (f[sel].value === "x" ? Number(f[other].value) : Number(f[sel].value));

const actions = {
  retry: rerender,
  logout: async () => { await A.sb.auth.signOut(); },
  copy: (b) => copy(b.dataset.text),
  sendcode: (b) => confirmAnd("Você já conferiu o pagamento Pix? O código será enviado ao estudante agora.", async () => { await rpc("admin_send_subscription_code", { p_request: b.dataset.id }); toast("Código enviado ao estudante."); rerender(); }),
  cancelsub: (b) => confirmAnd("Cancelar esta solicitação? Um código já enviado será revogado.", async () => { await rpc("admin_cancel_subscription_request", { p_request: b.dataset.id }); rerender(); }),
  sendpix: async (b) => { await rpc("admin_send_pix_to_student", { p_alert: b.dataset.id }); toast("Nova chave enviada ao estudante."); rerender(); },
  sendall: async () => { const n = await rpc("admin_send_pix_to_all"); toast(`Nova chave enviada a ${n} estudante(s).`); rerender(); },
  codefilter: (b) => { A.codeFilter = b.dataset.s; rerender(); },
  revcode: (b) => confirmAnd("Revogar este código? Ele deixará de funcionar.", async () => { await rpc("admin_revoke_access_code", { p_code_id: b.dataset.id, p_reason: "Revogado pelo painel" }); rerender(); }),
  delnews: (b) => confirmAnd("Remover esta novidade para todos os estudantes?", async () => { await rpc("admin_deactivate_announcement", { p_id: b.dataset.id }); rerender(); }),
  // estudante
  revlic: (b) => confirmAnd("Encerrar esta licença agora? O estudante perde o acesso.", async () => { await rpc("admin_revoke_license", { p_license: b.dataset.id, p_reason: "Encerrada pelo painel" }); rerender(); }),
  suspend: () => confirmAnd("Suspender esta conta? O estudante será desconectado e não conseguirá entrar.", async () => { await rpc("admin_set_student_status", { p_student: A.sid, p_status: "suspended", p_reason: "Painel" }); rerender(); }),
  reactivate: async () => { await rpc("admin_set_student_status", { p_student: A.sid, p_status: "active", p_reason: "Painel" }); rerender(); },
  revsess: () => confirmAnd("Encerrar todas as sessões e aparelhos deste estudante?", async () => { await rpc("admin_revoke_student_sessions", { p_student: A.sid, p_reason: "Painel" }); toast("Sessões encerradas."); rerender(); }),
  recovery: async () => { const r = await rpc("admin_create_recovery_token", { p_student: A.sid, p_ttl_hours: 48 }); A.eph.token = r[0]; rerender(); },
  newcode: async () => { const r = await rpc("admin_create_access_codes", { p_count: 1, p_duration_days: 30, p_redeem_by: null, p_intended_student: A.sid, p_notes: "Código individual" }); A.eph.code = r[0].code; rerender(); },
  // conteúdo
  togsubj: async (b) => { await tbl(A.sb.from("subjects").update({ [b.dataset.f]: b.getAttribute("aria-checked") !== "true" }).eq("id", b.dataset.id)); rerender(); },
  flagdone: async (b) => { await tbl(A.sb.from("question_flags").update({ status: b.dataset.s }).eq("id", b.dataset.id)); rerender(); },
  moreq: async () => { A.qpage++; await fetchQuestions(false); body("content", V.viewQuestions({ list: A.qlist, subjects: A.subjects, f: A.qf, more: A.qmore })); },
  preview: () => { const v = readQuestion(document.querySelector("[data-form=question]"), true); document.getElementById("preview").innerHTML = V.viewPreview({ subject: A.subjects.find((s) => s.id === v.subject_id)?.name || "", topic: A.topics.find((t) => t.id === v.topic_id)?.name || "", statement: v.statement || "(sem enunciado)", explanation: v.explanation, options: v.options }); },
  archiveq: () => confirmAnd("Arquivar esta questão? Ela some para os estudantes, mas o histórico de respostas é mantido.", async () => { await tbl(A.sb.from("questions").update({ status: "archived" }).eq("id", A.qid)); toast("Questão arquivada."); rerender(); }),
  export: async () => {
    await loadRef(); const rows = await tbl(A.sb.from("questions").select("statement,explanation,difficulty,reference_text,needs_review,status,subject_id,topic_id,question_options(label,body,explanation,is_correct)").range(0, 4999));
    const sj = Object.fromEntries(A.subjects.map((s) => [s.id, s.slug])), tn = Object.fromEntries(A.topics.map((t) => [t.id, t.name]));
    const out = { version: 1, exported_at: new Date().toISOString(), questions: rows.map((q) => ({ subject: sj[q.subject_id], topic: tn[q.topic_id], difficulty: q.difficulty, statement: q.statement, explanation: q.explanation, reference: q.reference_text, status: q.status, needs_review: q.needs_review,
      options: [...q.question_options].sort((a, b) => a.label.localeCompare(b.label)).map((o) => ({ text: o.body, correct: o.is_correct, explanation: o.explanation })) })) };
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
    a.download = `farmaquiz-questoes-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  doimport: async () => {
    const list = A.imp.valid; let n = 0;
    for (const q of list) {
      const row = await tbl(A.sb.from("questions").insert({ subject_id: q.subject_id, topic_id: q.topic_id, statement: q.statement, explanation: q.explanation, difficulty: q.difficulty, reference_text: q.reference || null, needs_review: true, status: "draft" }).select("id").single());
      await tbl(A.sb.from("question_options").insert(q.options.map((o, i) => ({ question_id: row.id, label: "ABCD"[i], body: o.text, explanation: o.explanation || null, is_correct: !!o.correct })))); n++;
    }
    A.imp = null; toast(`${n} questão(ões) importada(s) como rascunho.`); location.hash = "#/content/q";
  },
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]"); if (!b || !actions[b.dataset.act]) return;
  if (b.dataset.act === "subjchange") return;
  if (b.tagName === "A") e.preventDefault();
  if (A.busy) return; A.busy = true; b.disabled = true;
  Promise.resolve().then(() => actions[b.dataset.act](b)).catch((x) => toast(x.message)).finally(() => { A.busy = false; if (b.isConnected) b.disabled = false; });
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.act === "subjchange") { const sel = document.getElementById("qt"); sel.innerHTML = A.topics.filter((x) => x.subject_id === t.value).map((x) => `<option value="${V_esc(x.id)}">${V_esc(x.name)}</option>`).join(""); }
  if (t.id === "file" && t.files[0]) readImport(t.files[0]);
});
const V_esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- questões: leitura/validação do formulário ----------
function readQuestion(f, soft = false) {
  const g = (n) => f.elements[n].value, c = f.elements.correct, ci = [...c].findIndex((r) => r.checked);
  const options = [0, 1, 2, 3].map((i) => ({ body: g("ob" + i).trim(), explanation: g("ox" + i).trim() || null, correct: i === ci }));
  const v = { subject_id: g("qs"), topic_id: g("qt"), difficulty: g("qd"), status: g("qa"), statement: g("qe").trim(), explanation: g("qx").trim(), reference_text: g("qr").trim() || null, needs_review: f.elements.qv.checked, options };
  if (soft) return v;
  if (v.statement.length < 10) v.error = "O enunciado precisa ter ao menos 10 caracteres.";
  else if (v.explanation.length < 10) v.error = "Escreva a explicação didática (mínimo de 10 caracteres).";
  else if (options.some((o) => !o.body)) v.error = "Preencha as quatro alternativas.";
  else if (new Set(options.map((o) => o.body.toLowerCase())).size < 4) v.error = "As alternativas precisam ser diferentes entre si.";
  else if (ci < 0) v.error = "Marque qual alternativa é a correta.";
  else if (!v.topic_id) v.error = "Escolha o tema.";
  return v;
}
async function saveQuestion(f) {
  const v = readQuestion(f); if (v.error) throw new Error(v.error);
  const fields = { subject_id: v.subject_id, topic_id: v.topic_id, difficulty: v.difficulty, statement: v.statement, explanation: v.explanation, reference_text: v.reference_text, needs_review: v.needs_review };
  if (!A.qid) {
    const row = await tbl(A.sb.from("questions").insert({ ...fields, status: "draft" }).select("id").single());
    await tbl(A.sb.from("question_options").insert(v.options.map((o, i) => ({ question_id: row.id, label: "ABCD"[i], body: o.body, explanation: o.explanation, is_correct: o.correct }))));
    if (v.status !== "draft") await tbl(A.sb.from("questions").update({ status: v.status }).eq("id", row.id));
    toast("Questão criada."); location.hash = "#/question/" + row.id; return;
  }
  try {
    if (A.qcur.status === "published") await tbl(A.sb.from("questions").update({ status: "draft" }).eq("id", A.qid)); // despublica para editar com segurança
    await tbl(A.sb.from("questions").update(fields).eq("id", A.qid));
    await tbl(A.sb.from("question_options").update({ is_correct: false }).eq("question_id", A.qid));
    for (let i = 0; i < 4; i++) {
      const ex = A.qcur.options.find((o) => o.label === "ABCD"[i]), o = v.options[i], patch = { body: o.body, explanation: o.explanation, is_correct: o.correct };
      if (ex) await tbl(A.sb.from("question_options").update(patch).eq("id", ex.id));
      else await tbl(A.sb.from("question_options").insert({ question_id: A.qid, label: "ABCD"[i], ...patch }));
    }
    await tbl(A.sb.from("questions").update({ status: v.status }).eq("id", A.qid));
  } catch (e) { throw new Error("Não foi possível concluir. A questão ficou como rascunho. " + e.message); }
  toast("Questão salva."); rerender();
}

// ---------- importação ----------
function readImport(file) {
  const fr = new FileReader();
  fr.onload = async () => {
    await loadRef(); const errors = [], valid = [];
    let data; try { data = JSON.parse(fr.result); } catch { A.imp = { valid, errors: ["O arquivo não é um JSON válido."] }; return screens.content("io"); }
    const list = Array.isArray(data) ? data : data.questions;
    if (!Array.isArray(list) || !list.length) errors.push("Não encontrei a lista de questões (campo “questions”).");
    else if (list.length > 500) errors.push("Máximo de 500 questões por importação.");
    else {
      const have = new Set((await tbl(A.sb.from("questions").select("statement").range(0, 9999))).map((x) => x.statement.trim().toLowerCase())), seen = new Set();
      list.forEach((q, i) => {
        const at = `Questão ${i + 1}: `, sj = A.subjects.find((s) => s.slug === q.subject), tp = sj && A.topics.find((t) => t.subject_id === sj.id && t.name.toLowerCase() === String(q.topic || "").toLowerCase());
        const st = String(q.statement || "").trim(), ex = String(q.explanation || "").trim(), opts = Array.isArray(q.options) ? q.options : [];
        if (!sj) return errors.push(at + "disciplina (slug) inexistente."); if (!tp) return errors.push(at + "tema inexistente nesta disciplina.");
        if (!["facil", "medio", "dificil"].includes(q.difficulty)) return errors.push(at + "dificuldade deve ser facil, medio ou dificil.");
        if (st.length < 10 || ex.length < 10) return errors.push(at + "enunciado e explicação precisam de ao menos 10 caracteres.");
        if (opts.length !== 4 || opts.some((o) => !String(o.text || "").trim()) || opts.filter((o) => o.correct).length !== 1) return errors.push(at + "são necessárias 4 alternativas preenchidas e exatamente 1 correta.");
        if (new Set(opts.map((o) => String(o.text).trim().toLowerCase())).size < 4) return errors.push(at + "alternativas repetidas.");
        const k = st.toLowerCase(); if (have.has(k) || seen.has(k)) return errors.push(at + "enunciado repetido.");
        seen.add(k); valid.push({ subject_id: sj.id, topic_id: tp.id, difficulty: q.difficulty, statement: st, explanation: ex, reference: q.reference ? String(q.reference) : null, options: opts.map((o) => ({ text: String(o.text).trim(), explanation: o.explanation ? String(o.explanation) : null, correct: !!o.correct })) });
      });
    }
    A.imp = { valid, errors }; screens.content("io");
  };
  fr.readAsText(file);
}

// ---------- formulários ----------
const forms = {
  login: async (f) => {
    const { error } = await A.sb.auth.signInWithPassword({ email: f.em.value.trim(), password: f.pw.value });
    if (error) throw new Error("E-mail ou senha incorretos."); await start();
  },
  pix: async (f) => { await rpc("admin_set_pix", { p_receiver: f.rn.value, p_bank: f.bk.value, p_key: f.ky.value }); toast("Chave Pix atualizada para todos."); rerender(); },
  search: async (f) => { A.search = f.sq.value.trim(); rerender(); },
  grant: async (f) => {
    const d = daysFrom(f, "gd", "gx"); if (!(d >= 1 && d <= 3650)) throw new Error("Informe uma duração de 1 a 3650 dias.");
    await rpc("admin_grant_license", { p_student: A.sid, p_days: d, p_mode: f.gm.value, p_notes: f.gn.value || null }); toast("Licença concedida."); rerender();
  },
  notes: async (f) => { await rpc("admin_set_student_notes", { p_student: A.sid, p_notes: f.nt.value }); toast("Observações salvas."); },
  gencodes: async (f) => {
    const d = daysFrom(f, "cd", "cx"), n = Number(f.cq.value); if (!(d >= 1 && d <= 3650)) throw new Error("Informe uma duração de 1 a 3650 dias.");
    const by = f.cr.value ? new Date(f.cr.value + "T23:59:59").toISOString() : null;
    const r = await rpc("admin_create_access_codes", { p_count: n, p_duration_days: d, p_redeem_by: by, p_intended_student: null, p_notes: f.cn.value || null });
    A.created = r.map((x) => x.code); rerender();
  },
  news: async (f) => { await rpc("admin_publish_announcement", { p_title: f.nt.value, p_body: f.nb.value }); toast("Novidade publicada."); rerender(); },
  qfilter: async (f) => { A.qf = { subject: f.fs.value, status: f.ft.value, text: f.fq.value, review: f.elements.fr.checked }; rerender(); },
  question: saveQuestion,
  newsubject: async (f) => {
    const name = f.sn.value.trim(); if (name.length < 3) throw new Error("Informe o nome da disciplina.");
    await tbl(A.sb.from("subjects").insert({ slug: slug(name), name, description: f.sd.value.trim() || null, sort_order: (A.subjects.at(-1)?.sort_order || 0) + 1, is_published: false })); toast("Disciplina criada (despublicada). Publique quando tiver questões."); rerender();
  },
  newtopic: async (f) => {
    const name = f.tn.value.trim(); if (name.length < 2) throw new Error("Informe o nome do tema.");
    await tbl(A.sb.from("topics").insert({ subject_id: f.ts.value, slug: slug(name), name, sort_order: (A.topics.filter((t) => t.subject_id === f.ts.value).length || 0) + 1 })); toast("Tema criado."); rerender();
  },
  setting: async (f) => {
    const k = f.dataset.key, t = V.SETTINGS.find((s) => s[0] === k)[2], raw = f.v.value; let val;
    if (t === "number") { val = Number(raw); if (!Number.isInteger(val) || val < 0) throw new Error("Informe um número inteiro."); } else if (t === "bool") val = raw === "true"; else { val = raw.trim(); if (!val) throw new Error("O texto não pode ficar vazio."); }
    await rpc("admin_set_setting", { p_key: k, p_value: val }); toast("Configuração salva.");
  },
};
document.addEventListener("submit", (e) => {
  e.preventDefault(); const f = e.target, h = forms[f.dataset.form]; if (!h || A.busy) return;
  A.busy = true; const btn = f.querySelector("[type=submit]"); if (btn) btn.disabled = true;
  Promise.resolve().then(() => h(f)).catch((x) => setErr(f, x.message)).finally(() => { A.busy = false; if (btn && btn.isConnected) btn.disabled = false; });
});
