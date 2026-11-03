// FarmaQuiz | app do estudante. Sem build: abre direto no navegador.
import { api, getToken, setToken, ApiError } from "./api.js";
import * as V from "./views.js";
import { accessLabel, mmss } from "./ui.js";

const $ = (id) => document.getElementById(id);
const app = $("app"), tabs = $("tabs"), chip = $("chip"), toastEl = $("toast");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const S = { settings: null, me: null, unread: 0, period: "all", Z: null, loading: false, timer: null, busy: false, last: "" };

// ---------- infraestrutura ----------
function paint(html) { S.loading = html === V.viewLoading(); app.innerHTML = html; }
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove("show"), 4500); }
function go(to) { if (location.hash === "#/" + to) route(); else location.hash = "#/" + to; }
function setErr(el, msg) { const e = el && el.querySelector(".err"); if (e) e.textContent = msg; else toast(msg); }
function cleanup() { if (S.timer) { clearInterval(S.timer); S.timer = null; } }

function fail(e) {
  if (e instanceof ApiError) {
    if (e.status === 401) { setToken(null); S.me = null; toast(e.message); return go("signup"); }
    if (e.code === "no_access") { loadMe().then(() => go("expired")).catch(() => {}); return; }
    if (e.code === "subject_locked") { toast(e.message); return go("profile"); }
    if (e.code === "maintenance" || e.code === "config") return paint(V.viewFatal(e.message, e.code !== "config"));
    toast(e.message);
    if (S.loading) paint(V.viewFatal(e.message));
    return;
  }
  console.error(e); toast("Algo deu errado. Tente novamente.");
  if (S.loading) paint(V.viewFatal("Algo deu errado. Tente novamente."));
}

async function loadMe() { S.me = await api("GET", "/me"); chipUpdate(); return S.me; }
function chipUpdate() {
  chip.hidden = !S.me; if (!S.me) return;
  chip.textContent = accessLabel(S.me.access); chip.className = "chip" + (S.me.access.state === "expired" ? " warn" : "");
}
async function refreshUnread() { try { const n = await api("GET", "/announcements"); S.unread = n.unread; return n; } catch { return null; } }
function tabsUpdate(active) {
  const show = S.me && ["licensed", "trial"].includes(S.me.access.state) && active !== "quiz";
  tabs.hidden = !show; if (show) tabs.innerHTML = V.tabsHtml(active, S.unread, S.me);
}

// ---------- rotas ----------
const screens = {};
async function route() {
  cleanup(); S.Z = S.Z && S.Z.keep ? S.Z : null;
  const [name, arg] = (location.hash.replace(/^#\/?/, "") || "").split("/");
  const r = name || (S.me ? "home" : "signup");
  const open = ["signup", "recover"];
  if (!S.me && !open.includes(r)) return go("signup");
  if (S.me && open.includes(r)) return go("home");
  if (S.me) {
    const st = S.me.access.state;
    if (st === "suspended") { tabs.hidden = true; return paint(V.viewSuspended()); }
    if (st === "expired" && !["profile", "expired"].includes(r)) return go("expired");
    if (st !== "expired" && r === "expired") return go("home");
  }
  paint(V.viewLoading());
  try { await (screens[r] || screens.home)(arg); } catch (e) { fail(e); }
  if (S.last !== location.hash) { window.scrollTo(0, 0); S.last = location.hash; }
  const h = app.querySelector("h1"); if (h) { h.setAttribute("tabindex", "-1"); }
}

screens.signup = async () => { tabs.hidden = true; paint(V.viewSignup()); };
screens.recover = async () => { tabs.hidden = true; paint(V.viewRecover()); };

screens.home = async () => {
  await loadMe();
  if (S.me.access.state === "expired") return go("expired");
  const [stats, news] = await Promise.all([api("GET", "/stats"), refreshUnread()]);
  paint(V.viewHome({ me: S.me, stats, news, settings: S.settings })); tabsUpdate("home");
};
screens.subjects = async () => {
  const subjects = await api("GET", "/subjects");
  paint(V.viewSubjects(subjects, S.me.access.state === "trial")); tabsUpdate("subjects");
};
screens.subject = async (id) => {
  const subjects = await api("GET", "/subjects");
  const s = subjects.find((x) => x.id === id && !x.locked);
  paint(V.viewSubject(s)); tabsUpdate("subjects");
};
screens.simulado = async () => { paint(V.viewSimulado(await api("GET", "/subjects"))); tabsUpdate("subjects"); };

screens.ranking = async () => { paint(V.viewRanking(await api("GET", "/ranking?period=" + S.period), S.period)); tabsUpdate("ranking"); };
screens.news = async () => {
  const n = await api("GET", "/announcements"); paint(V.viewNews(n)); tabsUpdate("news");
  if (n.unread > 0) { api("POST", "/announcements/read").then(() => { S.unread = 0; tabsUpdate("news"); }).catch(() => {}); }
};
screens.stats = async () => { paint(V.viewStats(await api("GET", "/stats"))); tabsUpdate("home"); };

async function subData() { return Promise.all([api("GET", "/subscription"), S.settings ? S.settings : api("GET", "/settings")]); }
screens.profile = async () => {
  await loadMe(); const [sub, st] = await subData(); S.settings = st;
  paint(V.viewProfile({ me: S.me, sub, plans: st.plans || [] })); tabsUpdate("profile");
};
screens.expired = async () => {
  const [sub, st] = await subData(); S.settings = st; tabs.hidden = true;
  paint(V.viewExpired({ me: S.me, sub, plans: st.plans || [], settings: st }));
};

// ---------- sessão de estudo ----------
async function startSession(body) { const r = await api("POST", "/sessions", body); go("quiz/" + r.session_id); }
function paintQuiz() { paint(V.viewQuiz(S.Z)); }
function startTimer() {
  if (S.Z.secs == null) return;
  S.timer = setInterval(async () => {
    S.Z.secs -= 1; const t = $("timer"); if (t) t.textContent = "Tempo restante: " + mmss(S.Z.secs);
    if (S.Z.secs <= 0) { cleanup(); toast("Tempo esgotado. Finalizando…"); await finishSession(S.Z.sid); }
  }, 1000);
}
async function finishSession(sid) { go("result/" + sid); }

screens.quiz = async (sid) => {
  if (!UUID.test(sid || "")) return go("home");
  tabs.hidden = true;
  const s = await api("GET", "/sessions/" + sid);
  if (s.status === "completed" || s.next_index >= s.total) return go("result/" + sid);
  const q = await api("GET", `/sessions/${sid}/questions/${s.next_index}`);
  S.Z = { sid, mode: s.mode, q, sel: null, flag: false, secs: s.seconds_left, shownAt: Date.now() };
  paintQuiz(); startTimer();
};
screens.result = async (sid) => {
  if (!UUID.test(sid || "")) return go("home");
  const r = await api("POST", `/sessions/${sid}/finish`); paint(V.viewResult(r)); tabsUpdate("home");
};
screens.review = async (sid) => {
  if (!UUID.test(sid || "")) return go("home");
  paint(V.viewReview(await api("GET", `/sessions/${sid}/review`))); tabsUpdate("home");
};

// ---------- ações (cliques) ----------
async function guarded(btn, fn) {
  if (S.busy) return; S.busy = true; if (btn) btn.disabled = true;
  try { await fn(); } catch (e) { fail(e); } finally { S.busy = false; if (btn && btn.isConnected) btn.disabled = false; }
}
const actions = {
  retry: () => route(),
  logout: async () => { try { await api("POST", "/logout"); } catch { /* sem problema */ } setToken(null); S.me = null; S.unread = 0; chipUpdate(); tabs.hidden = true; go("signup"); },
  continue: async () => {
    const a = await api("GET", "/sessions/active");
    if (a && a.session_id) return go("quiz/" + a.session_id);
    await startSession({ mode: "study", count: 10 });
  },
  review: () => startSession({ mode: "review", count: 20 }),
  start: (b) => startSession({ mode: "study", subjectId: b.dataset.subject, topicId: b.dataset.topic || undefined, count: Number($("cnt")?.value || 10) }),
  period: (b) => { S.period = b.dataset.p === "week" ? "week" : "all"; return route(); },
  // quiz
  opt: (b) => { if (S.Z && !S.Z.q.answered) { S.Z.sel = b.dataset.id; paintQuiz(); } },
  confirm: async () => {
    const Z = S.Z; if (!Z || !Z.sel) return;
    const r = await api("POST", `/sessions/${Z.sid}/answer`, { questionId: Z.q.question_id, optionId: Z.sel, responseMs: Date.now() - Z.shownAt });
    if (!r.ok) { if (r.reason === "time_over" || r.reason === "session_closed") return finishSession(Z.sid); return; }
    Z.q = r.question; paintQuiz(); const fb = app.querySelector(".fb"); if (fb) fb.scrollIntoView({ block: "nearest" });
  },
  next: async () => {
    const Z = S.Z; if (!Z) return;
    if (Z.q.index + 1 >= Z.q.total) return finishSession(Z.sid);
    Z.q = await api("GET", `/sessions/${Z.sid}/questions/${Z.q.index + 1}`); Z.sel = null; Z.flag = false; Z.shownAt = Date.now(); paintQuiz(); window.scrollTo(0, 0);
  },
  fav: async () => { const r = await api("POST", "/favorites", { questionId: S.Z.q.question_id }); S.Z.q.is_favorite = r.is_favorite; paintQuiz(); },
  flagOpen: () => { S.Z.flag = !S.Z.flag; paintQuiz(); },
  // perfil
  avatar: async (b) => { await api("POST", "/profile", { avatarId: b.dataset.id === "" ? null : Number(b.dataset.id) }); await screens.profile(); },
  toggleRank: async () => { await api("POST", "/profile", { showInRanking: !S.me.show_in_ranking }); await screens.profile(); },
  // assinatura
  plan: async (b) => { await api("POST", "/subscription/request", { plan: b.dataset.plan }); return route(); },
  paid: async () => { await api("POST", "/subscription/paid"); return route(); },
  pixbad: async () => { await api("POST", "/subscription/pix-problem"); toast("Aviso enviado ao administrador."); return route(); },
  ackpix: async () => { await api("POST", "/subscription/ack-pix"); return route(); },
  activate: async () => { await api("POST", "/subscription/activate"); await loadMe(); toast("Acesso ativado! Bons estudos."); go("home"); },
  copypix: async (b) => {
    const sub = await api("GET", "/subscription");
    try { await navigator.clipboard.writeText(sub.pix.key); toast("Chave Pix copiada."); } catch { toast("Não foi possível copiar. Selecione e copie a chave manualmente."); }
  },
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]"); if (!b || !actions[b.dataset.act]) return;
  const quick = ["opt", "flagOpen", "retry"].includes(b.dataset.act);
  if (quick) { try { const r = actions[b.dataset.act](b); if (r && r.catch) r.catch(fail); } catch (x) { fail(x); } return; }
  guarded(b, () => actions[b.dataset.act](b));
});

const forms = {
  signup: async (f) => {
    const r = await api("POST", "/register", { fullName: f.nm.value, phone: f.ph.value, acceptTerms: f.tm.checked });
    setToken(r.token); await loadMe(); go("home");
  },
  recover: async (f) => {
    const r = await api("POST", "/recover", { phone: f.ph.value, recoveryToken: f.rc.value });
    setToken(r.token); await loadMe(); go("home");
  },
  redeem: async (f) => {
    await api("POST", "/redeem", { code: f.code.value }); await loadMe(); toast("Acesso ativado! Bons estudos."); go("home");
  },
  name: async (f) => { await api("POST", "/profile", { fullName: f.pn.value }); toast("Nome atualizado."); await screens.profile(); },
  simulado: async (f) => {
    await startSession({ mode: "simulado", subjectId: f.sj.value || undefined, count: Number(f.ct.value),
      timeLimitMinutes: f.tm.checked ? Math.min(300, Math.max(1, Number(f.mn.value) || 30)) : undefined });
  },
  flag: async (f) => {
    await api("POST", "/flags", { questionId: S.Z.q.question_id, reason: f.fr.value }); S.Z.flag = false; paintQuiz(); toast("Obrigado! Vamos revisar esta questão.");
  },
};
document.addEventListener("submit", (e) => {
  e.preventDefault(); const f = e.target, h = forms[f.dataset.form]; if (!h) return;
  if (S.busy) return; S.busy = true; const btn = f.querySelector("[type=submit]"); if (btn) btn.disabled = true;
  h(f).catch((x) => { if (x instanceof ApiError && x.status !== 401 && x.code !== "no_access" && x.code !== "subject_locked") setErr(f, x.message); else fail(x); })
    .finally(() => { S.busy = false; if (btn && btn.isConnected) btn.disabled = false; });
});

// ---------- início ----------
async function boot() {
  paint(V.viewLoading());
  try { S.settings = await api("GET", "/settings"); } catch (e) { return fail(e); }
  if (S.settings.maintenance_mode === true) return paint(V.viewFatal("O FarmaQuiz está em manutenção. Volte em instantes.", true));
  if (getToken()) { try { await loadMe(); } catch (e) { if (!(e instanceof ApiError && e.status === 401)) return fail(e); setToken(null); S.me = null; } }
  window.addEventListener("hashchange", route); route();
}
boot();
