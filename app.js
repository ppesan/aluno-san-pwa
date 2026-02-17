/* =========================
   aluno.san – app.js (limpo, robusto)
   - CSV com aspas/vírgulas OK
   - ativo: TRUE/FALSE OK
   - acesso: publico | aluno | prof
   - sem heurística automática de emojis
========================= */

const CSV_URLS = {
  itens: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSr4o5yxLQTP-MxL_gBjHC2LqsMbV8LdxlmOUG3VhGVUPMOy9m6n4pCMor4ghtHtDmLOYfkvGdIKCEA/pub?gid=1651715340&single=true&output=csv",
  avisos: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSr4o5yxLQTP-MxL_gBjHC2LqsMbV8LdxlmOUG3VhGVUPMOy9m6n4pCMor4ghtHtDmLOYfkvGdIKCEA/pub?gid=1684382034&single=true&output=csv"
};

const INSTITUTION_DOMAIN = "iffarroupilha.edu.br";

const qs = new URLSearchParams(location.search);
const FORCE_NET = qs.get("forceNet") === "1";
const FORCE_AVISO = qs.get("forceAviso") === "1";
const IS_PROF_PATH = location.pathname.startsWith("/prof");

const safe = (v) => (v ?? "").toString().trim();
const lower = (v) => safe(v).toLowerCase();

function truthy(v) {
  const s = lower(v);
  return s === "true" || s === "1" || s === "sim" || s === "yes" || s === "ok" || s === "x";
}

function numOr(v, fallback = 999999) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

/* =========================
   CSV parser robusto (aspas + vírgulas)
========================= */
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    // "" -> "
    if (ch === '"' && inQ && line[i + 1] === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCSV(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  // headers (remove BOM)
  const headers = parseCsvLine(lines[0]).map((h) => safe(h).replace(/^\uFEFF/, "").toLowerCase());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = cols[idx] ?? ""));
    rows.push(obj);
  }
  return rows;
}

async function fetchCSV(url) {
  const u = new URL(url);
  if (FORCE_NET) u.searchParams.set("_ts", Date.now().toString());
  const res = await fetch(u.toString(), { cache: FORCE_NET ? "no-store" : "default" });
  if (!res.ok) throw new Error(`CSV falhou: ${res.status}`);
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
  return lower(email).endsWith("@" + INSTITUTION_DOMAIN);
}

/* =========================
   Render Card (sem emojis forçados)
========================= */
function buildCard({ title, desc, href }) {
  const a = document.createElement("a");
  a.className = "card";
  a.href = href || "#";

  // se for link relativo, abre no mesmo app; se for externo, nova aba
  const isRelative = safe(href).startsWith("/");
  a.target = isRelative ? "_self" : "_blank";
  a.rel = "noopener noreferrer";

  const h = document.createElement("div");
  h.className = "card-title";
  h.textContent = title || "(sem título)";

  a.appendChild(h);

  if (desc) {
    const d = document.createElement("div");
    d.className = "card-desc";
    d.textContent = desc;
    a.appendChild(d);
  }

  return a;
}

/* =========================
   Card Professor na Home (profCardSlot)
========================= */
async function renderProfCardSlot() {
  const slot = document.getElementById("profCardSlot");
  if (!slot) return;

  slot.innerHTML = "";

  const session = await getSession();
  const auth = !!session?.authenticated;
  const email = safe(session?.email);

  // Se logou com email não institucional, não mostra o botão professor
  if (auth && !isInstitutional(email)) return;

  const next = encodeURIComponent("/prof/");
  const href = auth ? "/prof/" : `/login/?next=${next}`;

  const card = buildCard({
    title: auth ? "🦉 Painel do Professor" : "🦉 Área dos Professores",
    desc: auth ? `Logado como: ${email}` : "Entrar com Google institucional.",
    href
  });

  // deixa destacado se você tiver CSS para isso
  card.classList.add("card-prof");
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

  const h2 = document.createElement("h2");
  h2.textContent = title || "Aviso";

  const p = document.createElement("p");
  p.textContent = text || "";

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = "Entendi";

  btn.onclick = () => {
    root.innerHTML = "";
    onClose && onClose();
  };

  actions.appendChild(btn);
  modal.appendChild(h2);
  modal.appendChild(p);
  modal.appendChild(actions);
  backdrop.appendChild(modal);

  backdrop.addEventListener("click", (ev) => {
    if (ev.target === backdrop) btn.click();
  });

  root.appendChild(backdrop);
}

async function handleAvisos() {
  try {
    const avisos = await fetchCSV(CSV_URLS.avisos);
    const ativo = avisos.find((a) => truthy(a.ativo));
    if (!ativo) return;

    const avisoId = safe(ativo.aviso_id || ativo.id || ativo.titulo || "aviso");
    const key = `aviso_visto_${avisoId}`;

    if (localStorage.getItem(key) === "1" && !FORCE_AVISO) return;

    showModal({
      title: safe(ativo.titulo) || "Aviso",
      text: safe(ativo.texto) || "",
      onClose: () => localStorage.setItem(key, "1")
    });
  } catch {
    // silencioso
  }
}

/* =========================
   Filtragem (publico | aluno | prof)
========================= */
function canShowByAccess(accessValue) {
  const a = lower(accessValue);

  if (IS_PROF_PATH) {
    return a === "prof";
  }

  // Home
  return a === "publico" || a === "aluno";
}

/* =========================
   Carregar e renderizar
========================= */
async function load() {
  const list = document.getElementById("modulesList");
  if (!list) return;

  list.innerHTML = "";

  // /prof exige login institucional
  if (IS_PROF_PATH) {
    const session = await getSession();
    if (!session?.authenticated || !isInstitutional(session?.email)) {
      location.href = "/login/?next=" + encodeURIComponent("/prof/");
      return;
    }
  }

  let itens = [];
  try {
    itens = await fetchCSV(CSV_URLS.itens);
  } catch {
    list.textContent = "Erro ao carregar a planilha de links.";
    return;
  }

  // Remove o card AREA-PROF da lista principal para evitar duplicar
  // (ele aparece no profCardSlot)
  const filtered = itens
    .filter((i) => truthy(i.ativo))
    .filter((i) => safe(i.id) !== "AREA-PROF")
    .filter((i) => canShowByAccess(i.acesso))
    .sort((a, b) => numOr(a.ordem) - numOr(b.ordem));

  filtered.forEach((i) => {
    list.appendChild(
      buildCard({
        title: safe(i.titulo),
        desc: safe(i.descricao),
        href: safe(i.url)
      })
    );
  });

  // Home: adiciona card destacado de professores no slot final
  if (!IS_PROF_PATH) {
    await renderProfCardSlot();
  }

  await handleAvisos();
}

document.addEventListener("DOMContentLoaded", load);
