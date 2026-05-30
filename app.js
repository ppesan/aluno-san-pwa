/* aluno.san – app.js aluno */

const CSV_URLS = {
  itens: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSr4o5yxLQTP-MxL_gBjHC2LqsMbV8LdxlmOUG3VhGVUPMOy9m6n4pCMor4ghtHtDmLOYfkvGdIKCEA/pub?gid=1651715340&single=true&output=csv"
};

const qs = new URLSearchParams(location.search);
const FORCE_NET = qs.get("forceNet") === "1";

const safe = (v) => (v ?? "").toString().trim();
const lower = (v) => safe(v).toLowerCase();

function truthy(v) {
  const s = lower(v);
  return s === "true" || s === "verdadeiro" || s === "1" || s === "sim" || s === "yes" || s === "ok" || s === "x";
}

function numOr(v, fallback = 999999) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

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

  const headers = parseCsvLine(lines[0]).map((h) =>
    safe(h).replace(/^\uFEFF/, "").toLowerCase()
  );

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

  if (FORCE_NET) {
    u.searchParams.set("_ts", Date.now().toString());
  }

  const res = await fetch(u.toString(), {
    cache: FORCE_NET ? "no-store" : "default"
  });

  if (!res.ok) throw new Error(`CSV falhou: ${res.status}`);

  return parseCSV(await res.text());
}

function buildCard({ title, desc, href }) {
  const a = document.createElement("a");
  a.className = "card";
  a.href = href || "#";

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

function canShowForAluno(accessValue) {
  const a = lower(accessValue);

  return (
    a === "" ||
    a === "publico" ||
    a === "público" ||
    a === "aluno" ||
    a === "institucional"
  );
}

async function load() {
  const list =
    document.getElementById("modulesList") ||
    document.getElementById("modules");

  if (!list) return;

  list.innerHTML = "";

  let itens = [];

  try {
    itens = await fetchCSV(CSV_URLS.itens);
  } catch (e) {
    list.textContent = "Erro ao carregar a planilha de links.";
    return;
  }

  const filtered = itens
    .filter((i) => truthy(i.ativo))
    .filter((i) => canShowForAluno(i.acesso))
    .filter((i) => lower(i.id) !== "area-prof")
    .filter((i) => lower(i.titulo) !== "área dos professores")
    .filter((i) => lower(i.titulo) !== "area dos professores")
    .sort((a, b) => numOr(a.ordem) - numOr(b.ordem));

  filtered.forEach((i) => {
    list.appendChild(
      buildCard({
        title: safe(i.titulo || i.modulo),
        desc: safe(i.descricao),
        href: safe(i.url)
      })
    );
  });
}

document.addEventListener("DOMContentLoaded", load);
