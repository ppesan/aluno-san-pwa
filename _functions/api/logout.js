export async function onRequestPost() {
  const headers = new Headers();
  headers.append(
    "set-cookie",
    "aluno_san_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
  );
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

export async function onRequestGet() {
  // opcional: permite GET também
  const headers = new Headers();
  headers.append(
    "set-cookie",
    "aluno_san_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
  );
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
