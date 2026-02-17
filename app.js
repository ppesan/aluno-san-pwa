/* =========================
   CONFIG – CSVs publicados
========================= */
const CSV_URLS = {
  itens: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSr4o5yxLQTP-MxL_gBjHC2LqsMbV8LdxlmOUG3VhGVUPMOy9m6n4pCMor4ghtHtDmLOYfkvGdIKCEA/pub?gid=1651715340&single=true&output=csv",
  avisos: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSr4o5yxLQTP-MxL_gBjHC2LqsMbV8LdxlmOUG3VhGVUPMOy9m6n4pCMor4ghtHtDmLOYfkvGdIKCEA/pub?gid=1684382034&single=true&output=csv"
};

const INSTITUTION_DOMAIN = "iffarroupilha.edu.br";

/* =========================
   Params
========================= */
const qs = new URLSearchParams(location.search);
const FORCE_NET = qs.get("forceNet") === "1";
const FORCE_AVISO = qs.get("forceAviso") === "1";
const IS_PROF_PATH = location.pathname.startsWith("/prof");

/* =========================
   Utils
========================= */
const safe = v => (v ?? "").toString().trim();
const truthy = v => safe(v).toLowerCase() === "true";
const numOr = (v, f = 999999) => Number.isFinite(+v) ? +v : f;

/* =========================
   CSV Parser
========================= */
function parseCSV(text) {
  const lines = text.split("\n").filter(l => l.trim());
  const headers = lines[0].replace(/^\uFEFF/, "").split(",").map(h => h.trim().toLowerCase());

  return lines.slice(1).map(line => {
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h, i) => obj[h] = cols[i] ?? "");
    return obj;
  });
}

async function fetchCSV(url) {
  const u = new URL(url);
  if (FORCE_NET) u.searchParams.set("_ts", Date.now());

  const res = await fetch(u.toString(), { cache: FORCE_NET ? "no-store" : "default" });
  return parseCSV(await res.text());
}

/* =========================
   Sessão
========================= */
async function getSession() {
  try {
    const res = await fetch("/api/session", { credentials: "include" });
    if (!res.ok) return { authenticated: false };
    return await res.json();
  } catch {
    return { authenticated: false };
  }
}

function isInstitutional(email) {
  return safe(email).endsWith("@" + INSTITUTION_DOMAIN);
}

/* =========================
   Render Card
========================= */
function buildCard({ title, desc, href }) {
  const a = document.createElement("a");
  a.className = "card";
  a.href = href || "#";

  const h = document.createElement("div");
  h.className = "card-title";
  h.textContent = title;

  const d = document.createElement("div");
  d.className = "card-desc";
  d.textContent = desc || "";

  a.appendChild(h);
  if (desc) a.appendChild(d);

  return a;
}

/* =========================
   Área Professor (Home)
========================= */
async function renderProfCard() {
  const slot = document.getElementById("profCardSlot");
  if (!slot) return;

  slot.innerHTML = "";

  const session = await getSession();
  const auth = session?.authenticated;
  const email = safe(session?.email);

  if (auth && !isInstitutional(email)) return;

  if (!auth) {
    const card = buildCard({
      title: "Área dos Professores",
      desc: "Entrar com Google institucional.",
      href: "/login/?next=" + encodeURIComponent("/prof/")
    });
    slot.appendChild(card);
    return;
  }

  const card = buildCard({
    title: "Painel do Professor",
    desc: "Logado como: " + email,
    href: "/prof/"
  });

  slot.appendChild(card);
}

/* =========================
   Avisos (Popup)
========================= */
function showModal({ title, text, onClose }) {
  const root = document.getElementById("modalRoot");
  if (!root) return;

  root.innerHTML = "";

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";

  const modal = document.createElement("div");
  modal.className = "modal";

  modal.innerHTML = `
    <h2>${title}</h2>
    <p>${text}</p>
    <div class="modal-actions">
      <button class="btn btn-primary">Entendi</button>
    </div>
  `;

  modal.querySelector("button").onclick = () => {
    root.innerHTML = "";
    onClose && onClose();
  };

  backdrop.appendChild(modal);
  root.appendChild(backdrop);
}

async function handleAvisos() {
  const avisos = await fetchCSV(CSV_URLS.avisos);
  const ativo = avisos.find(a => truthy(a.ativo));
  if (!ativo) return;

  const id = safe(ativo.aviso_id || ativo.titulo);
  const key = "aviso_" + id;

  if (localStorage.getItem(key) && !FORCE_AVISO) return;

  showModal({
    title: ativo.titulo,
    text: ativo.texto,
    onClose: () => localStorage.setItem(key, "1")
  });
}

/* =========================
   Render Principal
========================= */
async function load() {
  const list = document.getElementById("modulesList");
  if (!list) return;

  list.innerHTML = "";

  if (IS_PROF_PATH) {
    const session = await getSession();
    if (!session.authenticated || !isInstitutional(session.email)) {
      location.href = "/login/?next=" + encodeURIComponent("/prof/");
      return;
    }
  }

  const itens = await fetchCSV(CSV_URLS.itens);

  const visiveis = itens
    .filter(i => truthy(i.ativo))
    .filter(i => {
      const a = safe(i.acesso).toLowerCase();
      if (IS_PROF_PATH) return a === "prof";
      return a === "publico" || a === "aluno";
    })
    .sort((a,b) => numOr(a.ordem) - numOr(b.ordem));

  visiveis.forEach(i => {
    list.appendChild(buildCard({
      title: i.titulo,
      desc: i.descricao,
      href: i.url
    }));
  });

  await renderProfCard();
  await handleAvisos();
}

document.addEventListener("DOMContentLoaded", load);
