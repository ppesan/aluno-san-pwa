// functions/api/session.js
function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(";").forEach((part) => {
    const [k, ...v] = part.trim().split("=");
    out[k] = decodeURIComponent(v.join("=") || "");
  });
  return out;
}

function decodeJwtPayload(jwt) {
  // jwt = header.payload.signature
  const parts = (jwt || "").split(".");
  if (parts.length < 2) return null;

  const b64 = parts[1]
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");

  try {
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isAllowedEmail(email) {
  return typeof email === "string" && email.toLowerCase().endsWith("@iffarroupilha.edu.br");
}

// POST: recebe o "credential" do Google, salva em cookie HttpOnly
export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const credential = body?.credential;
  if (!credential || typeof credential !== "string") {
    return new Response(JSON.stringify({ ok: false, error: "missing_credential" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  // (mínimo) valida payload do JWT
  const payload = decodeJwtPayload(credential);
  if (!payload || !isAllowedEmail(payload.email)) {
    return new Response(JSON.stringify({ ok: false, error: "email_not_allowed" }), {
      status: 403,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const headers = new Headers();
  headers.set("content-type", "application/json; charset=utf-8");

  // Cookie de sessão
  // SameSite=Lax funciona bem para este fluxo.
  headers.append(
    "set-cookie",
    `aluno_san_session=${encodeURIComponent(credential)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
  );

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

// GET: confirma se existe cookie válido e devolve authenticated true/false
export async function onRequestGet({ request }) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies.aluno_san_session;

  if (!token) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const payload = decodeJwtPayload(token);

  // checagens mínimas: exp e email institucional
  const now = Math.floor(Date.now() / 1000);
  const expOk = payload?.exp ? payload.exp > now : false;
  const emailOk = payload?.email ? isAllowedEmail(payload.email) : false;

  if (!payload || !expOk || !emailOk) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  return new Response(
    JSON.stringify({
      authenticated: true,
      email: payload.email,
      name: payload.name || null,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    }
  );
}

// fallback (outros métodos)
export async function onRequest({ request }) {
  return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
    status: 405,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
