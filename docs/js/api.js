// Comunicação com a API (Edge Function). O token de sessão fica só neste aparelho.
const KEY = "fq_token";
export const getToken = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* modo privado */ } };

export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export async function api(method, path, body, fetchImpl = fetch) {
  const base = (window.FARMAQUIZ || {}).API_URL || "";
  if (!base || base.includes("SEU-PROJETO")) {
    throw new ApiError(0, "config", "O site ainda não foi configurado. Edite o arquivo config.js com o endereço da API.");
  }
  const headers = { "Content-Type": "application/json" };
  const t = getToken();
  if (t) headers["x-session-token"] = t;
  let res;
  try {
    res = await fetchImpl(base + path, { method, headers, body: method === "POST" ? JSON.stringify(body ?? {}) : undefined });
  } catch {
    throw new ApiError(0, "network", "Sem conexão. Verifique sua internet e tente de novo.");
  }
  let data = null;
  try { data = await res.json(); } catch { /* resposta sem JSON */ }
  if (!res.ok) throw new ApiError(res.status, data?.error || "error", data?.message || "Não foi possível concluir a operação.");
  return data;
}
