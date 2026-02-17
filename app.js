/* =========================
   CONFIG — CSVs publicados
========================= */
const CSV_URLS = {
  itens: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSr4o5yxLQTP-MxL_gBjHC2LqsMbV8LdxlmOUG3VhGVUPMOy9m6n4pCMor4ghtHtDmLOYfkvGdIKCEA/pub?gid=1651715340&single=true&output=csv",
  avisos: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSr4o5yxLQTP-MxL_gBjHC2LqsMbV8LdxlmOUG3VhGVUPMOy9m6n4pCMor4ghtHtDmLOYfkvGdIKCEA/pub?gid=1684382034&single=true&output=csv",
  config: ""
};
const INSTITUTION_DOMAIN = "iffarroupilha.edu.br";

/* =========================
   Params de controle
========================= */
const qs = new URLSearchParams(location.search);
const FORCE_NET = qs.get("forceNet") === "1";
const FORCE_AVISO = qs.get("forceAviso") === "1";
const IS_PROF_PATH = location.pathname.startsWith("/prof");

/* =========================
   Utilitários
========================= */
function safeText(v) { return (v ?? "").toString().trim(); }
function truthy(v) {
  const s = safeText(v).toLowerCase();
  // cobre TRUE/true, SIM/sim, etc.
  return s === "true" || s === "1" || s === "yes" || s === "sim" || s === "ok" || s === "x";
}
function numOr(v, fallback = 999999) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

/* CSV parser (aspas + vírgula) */
function parseCSV(csvText) {
  const rows = [];
  let cur = "";
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (ch === '"' && inQuotes && next === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { inQuotes = !inQuotes; continue; }

    if (ch === "," && !inQuotes) { row.push(cur); cur = ""; continue; }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    cur += ch;
  }

  if (cur.length || row.length) { row.push(cur); rows.push(row); }

  const cleaned = rows.filter(r => r.some(c => safeText(c) !== ""));
  if (!cleaned.length) return [];

  // Normaliza headers: remove BOM e força minúsculas
  const headers = cleaned[0].map(h => safeText(h).replace(/^\uFEFF/, "").toLowerCase());

  return cleaned.slice(1).map(cols => {
    const obj = {};
    headers.forEach((h, idx) => obj[h] = cols[idx] ?? "");
    return obj;
  });
}

async function fetchCSV(url) {
  if (!url) return [];
  const u = new URL(url);
  if (FORCE_NET) u.searchParams.set("_ts", Date.now().toString());

  const res = await fetch(u.toString(), { cache: FORCE_NET ? "no-store" : "default" });
  if (!res.ok) throw new Error(`Falha ao carregar CSV: ${res.status}`);
  return parseCSV(await res.text());
}

/* =========================
   Sessão (prof)
========================= */
async function getSession() {
  try {
    const res = await fetch("/api/session", { method: "GET", credentials: "include" });
    if (!res.ok) return { authenticated: false };
    return await res.json();
  } catch {
    return { authenticated: false };
  }
}
function isInstitutionalEmail(email) {
  const domain = (safeText(email).split("@")[1] || "").toLowerCase();
  return domain === INSTITUTION_DOMAIN;
}

/* =========================
   Render de Cards
========================= */
function buildCard({ emoji = "➡️", title, desc, href }) {
  const a = document.createElement("a");
  a.className = "card";
  a.href = href || "#";

  const left = document.createElement("div");
  left.className = "card-left";

  const e = document.createElement("div");
  e.className = "card-emoji";
  e.textContent = emoji;

  const texts = document.createElement("div");
  texts.className = "card-texts";

  const h = document.createElement("p");
  h.className = "card-title";
  h.textContent = title;

  const d = document.createElement("p");
  d.className = "card-desc";
  d.textContent = desc || "";

  texts.appendChild(h);
  if (desc) texts.appendChild(d);

  left.appendChild(e);
  left.appendChild(texts);

  const chevron = document.createElement("div");
  chevron.className = "card-chevron";
  chevron.textContent = "›";

  a.appendChild(left);
  a.appendChild(chevron);
  return a;
}

function buildProfCard({ session }) {
  // Só existe na HOME. No /prof/ não precisa.
  const slot = document.getElementById("profCardSlot");
  if (!slot) return;

  slot.innerHTML = "";

  const authenticated = !!session?.authenticated;
  const email = safeText(session?.email);
  const institutional = authenticated && isInstitutionalEmail(email);

  // Se logou com email não institucional, não mostra o card
  if (authenticated && !institutional) return;

  let card;
  if (!authenticated) {
    const next = encodeURIComponent("/prof/");
    card = buildCard({
      emoji: "🔒",
      title: "Área dos Professores",
      desc: "Entrar com Google institucional para acessar.",
      href: `/login/?next=${next}`
    });
    card.classList.add("card-prof");
    slot.appendChild(card);
    return;
  }

  card = buildCard({
    emoji: "👨‍🏫",
    title: "Painel do Professor",
    desc: email ? `Logado como: ${email}` : "Acesso autorizado.",
    href: "/prof/"
  });
  card.classList.add("card-prof");

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = "Autorizado";
  card.querySelector(".card-chevron")?.remove();
  card.appendChild(badge);

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
  btn.addEventListener("click", () => {
    root.innerHTML = "";
    onClose && onClose();
  });

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
    if (!Array.isArray(avisos) || !avisos.length) return;

    // Procura primeiro aviso ativo
    const ativo = avisos.find(a => truthy(a.ativo));
    if (!ativo) return;

    const avisoId = safeText(ativo.aviso_id || ativo.id || ativo.titulo || "aviso");
    const key = `aviso_visto_${avisoId}`;

    const jaVisto = localStorage.getItem(key) === "1";
    if (jaVisto && !FORCE_AVISO) return;

    showModal({
      title: safeText(ativo.titulo) || "Aviso",
      text: safeText(ativo.texto) || "",
      onClose: () => localStorage.setItem(key, "1")
    });
  } catch {
    // silencioso
  }
}

/* =========================
   Carregar itens e renderizar
========================= */
function canShowByAccess(accessValue) {
  const a = safeText(accessValue).toLowerCase();

  // compatibilidade: se tiver "ambos" antigo, tratamos como público
  if (a === "ambos") return true;

  if (IS_PROF_PATH) {
    // Área professor: só "prof"
    return a === "prof";
  }

  // Home: "publico" e "aluno"
  return a === "publico" || a === "aluno";
}

function getModulesContainer() {
  return document.getElementById("modulesList") || document.getElementById("modules");
}

async function loadAndRender() {
  const list = getModulesContainer();
  if (!list) return;
  list.innerHTML = "";

  // Se estiver em /prof, exige login institucional
  if (IS_PROF_PATH) {
    const session = await getSession();
    const email = safeText(session?.email);
    if (!session?.authenticated || !isInstitutionalEmail(email)) {
      location.href = "/login/?next=" + encodeURIComponent("/prof/");
      return;
    }
  }

  let itens = [];
  try { itens = await fetchCSV(CSV_URLS.itens); } catch { itens = []; }

  const visible = (itens || [])
    .filter(x => truthy(x.ativo))
    .filter(x => canShowByAccess(x.acesso))
    .sort((a, b) => numOr(a.ordem) - numOr(b.ordem));

  for (const item of visible) {
    const title = safeText(item.titulo) || safeText(item.modulo) || "Módulo";
    const desc  = safeText(item.descricao) || "";
    const href  = safeText(item.url) || "#";

    // Emoji: usa heurística pelos campos, mas você já está definindo na planilha (modulo/titulo com emoji)
    const hint = `${safeText(item.tema)} ${safeText(item.tipo)} ${safeText(item.tags)} ${safeText(item.modulo)} ${safeText(item.titulo)}`.toLowerCase();
    const emoji =
      hint.includes("turma") ? "" :
      hint.includes("monitor") ? "" :
      hint.includes("calc") ? "" :
      hint.includes("siga") ? "" :
      hint.includes("reg") ? "" :
      hint.includes("instal") ? "" :
      hint.includes("cae") ? "" :
      hint.includes("orbital") ? "" :
      hint.includes("recuper") ? "" :
      "";

    list.appendChild(buildCard({ emoji, title, desc, href }));
  }

  const session = await getSession();
  buildProfCard({ session });

  // Popup de avisos (se existir modalRoot)
  handleAvisos();
}

document.addEventListener("DOMContentLoaded", loadAndRender);

