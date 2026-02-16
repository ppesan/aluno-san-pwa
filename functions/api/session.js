const COOKIE_NAME = "aluno_san_session";
const ALLOWED_DOMAIN = "iffarroupilha.edu.br";

export async function onRequestGet(context) {
  const cookie = context.request.headers.get("cookie") || "";
  const token = parseCookie(cookie)[COOKIE_NAME];

  if (!token) return json({ authenticated: false });

  // Valida o token de novo com o Google (mais confiável do que tentar atob)
  const info = await tokenInfo(token);
  if (!info.ok) {
    // token inválido/expirado -> força “deslogado”
    return json({ authenticated: false });
  }

  const email = (info.data.email || "").toLowerCase();
  const hd = (info.data.hd || "").toLowerCase();
  const emailDomain = (email.split("@")[1] || "").toLowerCase();

  const okDomain = (hd === ALLOWED_DOMAIN) || (emailDomain === ALLOWED_DOMAIN);
  if (!okDomain) return json({ authenticated: false });

  return json({ authenticated: true, email, hd: hd || null });
}

export async function onRequestPost(context) {
  const { request } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const credential = body?.credential;
  if (!credential) return json({ error: "Credencial ausente." }, 400);

  const info = await tokenInfo(credential);
  if (!info.ok) return json({ error: "Token inválido." }, 401);

  const email = (info.data.email || "").toLowerCase();
  const hd = (info.data.hd || "").toLowerCase();
  const emailDomain = (email.split("@")[1] || "").toLowerCase();

  const okDomain = (hd === ALLOWED_DOMAIN) || (emailDomain === ALLOWED_DOMAIN);
  if (!okDomain) {
    return json({ error: "Acesso permitido apenas para contas @iffarroupilha.edu.br." }, 403);
  }

  const headers = new Headers();
  headers.append(
    "set-cookie",
    buildCookie(COOKIE_NAME, credential, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8h
    })
  );

  return json({ ok: true, email, hd }, 200, headers);
}

// fallback: se bater em método não previsto
export async function onRequest() {
  return json({ error: "Método não permitido." }, 405);
}

/* =========================
   Helpers
========================= */

async function tokenInfo(idToken) {
  try {
    const res = await fetch(
      "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken),
      { cache: "no-store" }
    );

    if (!res.ok) return { ok: false, status: res.status, data: null };
    const data = await res.json();
    return { ok: true, status: 200, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

function json(obj, status = 200, headers = new Headers()) {
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(obj), { status, headers });
}

function parseCookie(cookieHeader) {
  const out = {};
  cookieHeader.split(";").forEach((part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(v.join("=") || "");
  });
  return out;
}

function buildCookie(name, value, opt) {
  const parts = [];
  parts.push(`${name}=${encodeURIComponent(value)}`);
  if (opt.maxAge != null) parts.push(`Max-Age=${opt.maxAge}`);
  if (opt.path) parts.push(`Path=${opt.path}`);
  if (opt.httpOnly) parts.push("HttpOnly");
  if (opt.secure) parts.push("Secure");
  if (opt.sameSite) parts.push(`SameSite=${opt.sameSite}`);
  return parts.join("; ");
}
