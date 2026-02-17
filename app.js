/* app.js (compatível com:
   - Home: #modulesList e #profCardSlot
   - Prof: #modulesList
   Planilha com acesso: publico | aluno | prof
*/

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSr4o5yxLQTP-MxL_gBjHC2LqsMbV8LdxlmOUG3VhGVUPMOy9m6n4pCMor4ghtHtDmLOYfkvGdIKCEA/pub?gid=1651715340&single=true&output=csv"; 
// Exemplo (formato):
// https://docs.google.com/spreadsheets/d/e/....../pub?gid=XXXX&single=true&output=csv

function clean(v) {
  return (v ?? "").toString().trim();
}

function normalizeAccess(v) {
  const a = clean(v).toLowerCase();
  if (a === "publico" || a === "aluno" || a === "prof") return a;
  return "publico";
}

function isProfArea() {
  return window.location.pathname.startsWith("/prof");
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    // "" -> "
    if (ch === '"' && line[i + 1] === '"') {
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

function csvToObjects(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map((h) => clean(h).toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = cols[idx] ?? ""));
    rows.push(obj);
  }
  return rows;
}

function isActive(row) {
  const v = clean(row.ativo).toUpperCase();
  return v === "TRUE" || v === "1" || v === "SIM";
}

function orderNum(row) {
  const n = Number(clean(row.ordem) || 9999);
  return Number.isFinite(n) ? n : 9999;
}

function buildCard(row) {
  const titulo = clean(row.titulo);
  const desc = clean(row.descricao);
  let url = clean(row.url);

  // Permite URL relativa tipo "/prof/"
  const isRelative = url.startsWith("/");

  // Se veio vazio, não quebra a página
  if (!url) url = "#";

  // Se não é relativa e não tem http/https, prefixa
  if (!isRelative && url !== "#" && !/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  const a = document.createElement("a");
  a.className = "card";
  a.href = url;
  a.target = isRelative ? "_self" : "_blank";
  a.rel = "noopener noreferrer";

  const t = document.createElement("div");
  t.className = "card-title";
  t.textContent = titulo || "(sem título)";

  a.appendChild(t);

  if (desc) {
    const d = document.createElement("div");
    d.className = "card-desc";
    d.textContent = desc;
    a.appendChild(d);
  }

  return a;
}

async function fetchSession() {
  try {
    const r = await fetch("/api/session", { credentials: "include" });
    if (!r.ok) return { authenticated: false };
    return await r.json();
  } catch {
    return { authenticated: false };
  }
}

async function loadSheetItems() {
  const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
  const csv = await res.text();
  return csvToObjects(csv)
    .filter(isActive)
    .map((r) => ({
      id: clean(r.id),
      titulo: clean(r.titulo),
      descricao: clean(r.descricao),
      url: clean(r.url),
      acesso: normalizeAccess(r.acesso),
      ordem: orderNum(r),
    }));
}

function renderList(container, items) {
  if (!container) return;
  container.innerHTML = "";
  items.forEach((row) => container.appendChild(buildCard(row)));
}

async function main() {
  const listEl = document.getElementById("modulesList");
  const profSlot = document.getElementById("profCardSlot");
  const profArea = isProfArea();

  // 1) Se for /prof/, exige login
  if (profArea) {
    const session = await fetchSession();
    if (!session.authenticated) {
      window.location.href = "/login/";
      return;
    }
  }

  // 2) Carrega itens da planilha
  let items = [];
  try {
    items = await loadSheetItems();
  } catch (e) {
    if (listEl) listEl.textContent = "Erro ao carregar a planilha de links.";
    return;
  }

  // 3) Separa “Área dos Professores” (id AREA-PROF) para renderizar só na Home e por último
  const areaProfCard = items.find((x) => x.id === "AREA-PROF");
  const rest = items.filter((x) => x.id !== "AREA-PROF");

  // 4) Filtra conforme a área
  if (profArea) {
    // PROF: só acesso=prof (ex.: Agenda Semanal)
    const profItems = rest
      .filter((x) => x.acesso === "prof")
      .sort((a, b) => a.ordem - b.ordem);

    renderList(listEl, profItems);

    // profSlot não existe em /prof/ (e tudo bem)
    return;
  }

  // HOME: publico + aluno
  const homeItems = rest
    .filter((x) => x.acesso === "publico" || x.acesso === "aluno")
    .sort((a, b) => a.ordem - b.ordem);

  renderList(listEl, homeItems);

  // 5) Professores SEMPRE por último na Home (se existir na planilha)
  if (profSlot) {
    profSlot.innerHTML = "";
    if (areaProfCard) {
      profSlot.appendChild(buildCard(areaProfCard));
    }
  }
}

document.addEventListener("DOMContentLoaded", main);


