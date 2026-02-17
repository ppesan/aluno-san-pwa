// app.js
// ATENÇÃO: ajuste aqui a URL do CSV "itens" (publicado como CSV)
const ITENS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSr4o5yxLQTP-MxL_gBjHC2LqsMbV8LdxlmOUG3VhGVUPMOy9m6n4pCMor4ghtHtDmLOYfkvGdIKCEA/pub?gid=1651715340&single=true&output=csv";

function $(sel) {
  return document.querySelector(sel);
}

function cleanText(v) {
  return (v ?? "").toString().trim();
}

function isProfPath() {
  return window.location.pathname.startsWith("/prof");
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

function parseCsvLine(line) {
  // CSV simples com aspas
  const out = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

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

  const headers = parseCsvLine(lines[0]).map((h) => cleanText(h).toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

function isActive(row) {
  const v = cleanText(row.ativo).toUpperCase();
  return v === "TRUE" || v === "1" || v === "SIM";
}

function normalizeAccess(v) {
  return cleanText(v).toLowerCase(); // publico | aluno | prof
}

function shouldShow(row, area) {
  // area: "home" ou "prof"
  const acesso = normalizeAccess(row.acesso);

  if (area === "prof") return acesso === "prof";
  // home
  return acesso === "publico" || acesso === "aluno";
}

function sortByOrder(a, b) {
  const oa = Number(cleanText(a.ordem) || 9999);
  const ob = Number(cleanText(b.ordem) || 9999);
  return oa - ob;
}

function buildCard(row) {
  const titulo = cleanText(row.titulo);
  const descricao = cleanText(row.descricao);
  let url = cleanText(row.url);

  // URLs relativas (ex.: /turma/)
  if (url.startsWith("/")) {
    // mantém
  } else if (url && !/^https?:\/\//i.test(url)) {
    // caso venha sem protocolo, evita quebrar
    url = "https://" + url;
  }

  const a = document.createElement("a");
  a.className = "card";
  a.href = url || "#";
  a.target = url.startsWith("/") ? "_self" : "_blank";
  a.rel = "noopener noreferrer";

  const h = document.createElement("div");
  h.className = "card-title";
  h.textContent = titulo || "(sem título)";

  const p = document.createElement("div");
  p.className = "card-desc";
  p.textContent = descricao;

  a.appendChild(h);
  if (descricao) a.appendChild(p);

  return a;
}

function setHeader(area, session) {
  const titleEl = $("#pageTitle");
  const subtitleEl = $("#pageSubtitle");
  const authEl = $("#authStatus");

  if (area === "prof") {
    if (titleEl) titleEl.textContent = "🦉 Área dos Professores";
    if (subtitleEl) subtitleEl.textContent = "Acesso restrito (conta @iffarroupilha.edu.br).";
  } else {
    if (titleEl) titleEl.textContent = "aluno.san";
    if (subtitleEl) subtitleEl.textContent = "";
  }

  if (authEl) {
    authEl.textContent = session?.authenticated ? `Logado: ${session.email}` : "";
  }
}

async function main() {
  const area = isProfPath() ? "prof" : "home";

  // Se estiver em /prof, exige login (cookie de sessão)
  const session = await fetchSession();
  setHeader(area, session);

  if (area === "prof" && !session.authenticated) {
    // manda para /login/ (página de login)
    window.location.href = "/login/";
    return;
  }

  // carrega itens da planilha
  let items = [];
  try {
    const res = await fetch(ITENS_CSV_URL, { cache: "no-store" });
    const csv = await res.text();
    items = csvToObjects(csv).filter(isActive);
  } catch (e) {
    const list = $("#cards");
    if (list) list.textContent = "Erro ao carregar a planilha de itens.";
    return;
  }

  const filtered = items.filter((row) => shouldShow(row, area)).sort(sortByOrder);

  const list = $("#cards");
  if (!list) return;

  list.innerHTML = "";
  filtered.forEach((row) => list.appendChild(buildCard(row)));

  // botão de navegação extra
  const nav = $("#extraNav");
  if (nav) {
    nav.innerHTML = "";

    if (area === "home") {
      const btn = document.createElement("a");
      btn.className = "btn";
      btn.href = "/prof/";
      btn.textContent = "🦉 Área dos Professores";
      nav.appendChild(btn);
    } else {
      const btnHome = document.createElement("a");
      btnHome.className = "btn";
      btnHome.href = "/";
      btnHome.textContent = "⬅ Voltar para a Home";
      nav.appendChild(btnHome);

      const btnLogout = document.createElement("button");
      btnLogout.className = "btn";
      btnLogout.textContent = "Sair";
      btnLogout.onclick = async () => {
        await fetch("/api/logout", { method: "POST", credentials: "include" });
        window.location.href = "/";
      };
      nav.appendChild(btnLogout);
    }
  }
}

document.addEventListener("DOMContentLoaded", main);
