/* aluno.san – app.js aluno */

const CSV_URLS = {
  itens: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSr4o5yxLQTP-MxL_gBjHC2LqsMbV8LdxlmOUG3VhGVUPMOy9m6n4pCMor4ghtHtDmLOYfkvGdIKCEA/pub?gid=1651715340&single=true&output=csv",
  avisos: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSr4o5yxLQTP-MxL_gBjHC2LqsMbV8LdxlmOUG3VhGVUPMOy9m6n4pCMor4ghtHtDmLOYfkvGdIKCEA/pub?gid=1684382034&single=true&output=csv"
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

function isProfessorArea(item) {
  const id = lower(item.id);
  const titulo = lower(item.titulo || item.modulo);
  const url = lower(item.url);

  return (
    id === "area-prof" ||
    id === "prof" ||
    titulo === "área dos professores" ||
    titulo === "area dos professores" ||
    titulo.includes("professores") ||
    url.includes("/prof")
  );
}

function showPopupAviso(aviso) {
  const modalRoot = document.getElementById("modalRoot");
  if (!modalRoot) return;

  const titulo = safe(aviso.titulo || aviso.título || "Aviso");
  const mensagem = safe(aviso.mensagem || aviso.texto || aviso.descricao || aviso.descrição);
  const link = safe(aviso.link || aviso.url);
  const textoBotao = safe(aviso.botao || aviso.botão || "Acessar");

  if (!mensagem) return;

  modalRoot.innerHTML = `
    <div style="
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.45);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
    ">
      <div style="
        background: #fff;
        width: min(440px, 100%);
        border-radius: 18px;
        padding: 22px;
        box-shadow: 0 12px 35px rgba(0,0,0,.25);
        font-family: system-ui, Arial, sans-serif;
      ">
        <h2 style="
          margin: 0 0 10px;
          font-size: 22px;
          color: #2e7d32;
        ">${titulo}</h2>

        <div style="
          color: #222;
          font-size: 16px;
          line-height: 1.45;
          white-space: pre-line;
          margin-bottom: 18px;
        ">${mensagem}</div>

        <div style="
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          flex-wrap: wrap;
        ">
          <button id="closeAvisoBtn" style="
            border: none;
            background: #e8e8e8;
            color: #222;
            border-radius: 10px;
            padding: 10px 14px;
            font-weight: 700;
            cursor: pointer;
          ">Fechar</button>

          ${
            link
              ? `<a href="${link}" target="_blank" rel="noopener noreferrer" style="
                  background: #43933C;
                  color: #fff;
                  text-decoration: none;
                  border-radius: 10px;
                  padding: 10px 14px;
                  font-weight: 800;
                ">${textoBotao}</a>`
              : ""
          }
        </div>
      </div>
    </div>
  `;

  document.getElementById("closeAvisoBtn").addEventListener("click", () => {
    modalRoot.innerHTML = "";
  });
}

async function loadAvisos() {
  let avisos = [];

  try {
    avisos = await fetchCSV(CSV_URLS.avisos);
  } catch (e) {
    return;
  }

  const ativos = avisos
    .filter((a) => truthy(a.ativo))
    .sort((a, b) => numOr(a.ordem) - numOr(b.ordem));

  if (!ativos.length) return;

  showPopupAviso(ativos[0]);
}

async function loadModulos() {
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
    .filter((i) => !isProfessorArea(i))
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

async function load() {
  await loadModulos();
  await loadAvisos();
}

document.addEventListener("DOMContentLoaded", load);
