async function onGoogleCredential(response) {
  const status = document.getElementById("status");
  status.textContent = "Validando…";

  try {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: response.credential }),
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      status.textContent = data?.error || "Falha no login.";
      return;
    }

    status.textContent = `OK: ${data.email}`;

    const next = new URL(location.href).searchParams.get("next") || "/prof/";
    location.href = next;
  } catch {
    status.textContent = "Erro de rede ao validar login.";
  }
}
window.onGoogleCredential = onGoogleCredential;
