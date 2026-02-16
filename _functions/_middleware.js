export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (url.pathname.startsWith("/prof")) {
    const cookie = request.headers.get("cookie") || "";
    const session = parseCookie(cookie)["aluno_san_session"];

    if (!session) {
      const loginUrl = new URL("/login/", url.origin);
      loginUrl.searchParams.set("next", url.pathname + url.search);
      return Response.redirect(loginUrl.toString(), 302);
    }

    try {
      const payload = JSON.parse(atob(session.split(".")[1] || ""));
      const email = (payload.email || "").toLowerCase();
      const domain = (email.split("@")[1] || "").toLowerCase();
      if (domain !== "iffarroupilha.edu.br") throw new Error("domain");
    } catch {
      const loginUrl = new URL("/login/", url.origin);
      loginUrl.searchParams.set("next", url.pathname + url.search);
      return Response.redirect(loginUrl.toString(), 302);
    }
  }

  return next();
}

function parseCookie(cookieHeader) {
  const out = {};
  cookieHeader.split(";").forEach(part => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(v.join("=") || "");
  });
  return out;
}
