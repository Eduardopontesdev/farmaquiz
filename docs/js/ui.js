// Funções de apoio (puras). TODO texto vindo do servidor passa por esc() antes de virar HTML.
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const AVATARS = [["🐶", "Cachorrinho"], ["🐱", "Gatinho"], ["🦊", "Raposinha"], ["🐼", "Panda"], ["🐨", "Coala"],
  ["🐸", "Sapinho"], ["🐵", "Macaquinho"], ["🦉", "Corujinha"], ["🐙", "Polvinho"], ["🐧", "Pinguim"]];

export function avatarHtml(id, name, size = "md") {
  if (Number.isInteger(id) && AVATARS[id]) return `<span class="av av-${size}" role="img" aria-label="${esc(AVATARS[id][1])}">${AVATARS[id][0]}</span>`;
  const ini = String(name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return `<span class="av av-${size} ini" aria-hidden="true">${esc(ini)}</span>`;
}

export const money = (cents) => "R$ " + (Number(cents) / 100).toFixed(2).replace(".", ",");
export const dateBR = (iso) => new Date(iso).toLocaleDateString("pt-BR");
export const pct = (n, d) => (d ? Math.round((100 * n) / d) + "%" : "—");

// Tempo restante calculado com o relógio do SERVIDOR (server_now), não o do aparelho.
export function msLeft(access) {
  if (!access || !access.ends_at || !access.server_now) return null;
  return Date.parse(access.ends_at) - Date.parse(access.server_now);
}
export function daysLeft(access) { const ms = msLeft(access); return ms == null ? null : Math.ceil(ms / 864e5); }
export function remainingText(access) {
  const ms = msLeft(access);
  if (ms == null) return "";
  if (ms <= 0) return "menos de 1 hora";
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5);
  return d >= 1 ? `${d} dia${d > 1 ? "s" : ""}` : `${Math.max(h, 1)} hora${h > 1 ? "s" : ""}`;
}
export function accessLabel(access) {
  if (!access) return "";
  if (access.state === "trial") return `Teste: ${remainingText(access)} restantes`;
  if (access.state === "licensed") return `Licença até ${dateBR(access.ends_at)}`;
  if (access.state === "suspended") return "Conta suspensa";
  return "Acesso encerrado";
}
export const mmss = (s) => `${String(Math.floor(Math.max(s, 0) / 60)).padStart(2, "0")}:${String(Math.max(s, 0) % 60).padStart(2, "0")}`;
