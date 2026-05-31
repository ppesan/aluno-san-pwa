/* aluno.san – app.js aluno */

const CSV_URLS = {
  itens: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSr4o5yxLQTP-MxL_gBjHC2LqsMbV8LdxlmOUG3VhGVUPMOy9m6n4pCMor4ghtHtDmLOYfkvGdIKCEA/pub?gid=1651715340&single=true&output=csv",
  avisos: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSr4o5yxLQTP-MxL_gBjHC2LqsMbV8LdxlmOUG3VhGVUPMOy9m6n4pCMor4ghtHtDmLOYfkvGdIKCEA/pub?gid=1684382034&single=true&output=csv"
};

const qs = new URLSearchParams(location.search);
const FORCE_NET = qs.get("forceNet") === "1";

const safe = (v) => (v ?? "").toString().trim();
const lower = (v) => safe(v).toLowerCase();

let deferredPrompt = null;
let avisosCache = [];
let waitingWorker = null;

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

function getAvisoId(aviso) {
  const id = safe(aviso.aviso_id || aviso.id);

  if (id) return id;

  return [
    safe(aviso.titulo || aviso.título || "Aviso"),
    safe(aviso.texto || aviso.mensagem || aviso.descricao || aviso.descrição)
  ].join("|");
}

function avisoStorageKey(aviso) {
  return `alunoSanAvisoVisto:${getAvisoId(aviso)}`;
}

function wasAvisoSeen(aviso) {
  try {
    return localStorage.getItem(avisoStorageKey(aviso)) === "1";
  } catch {
    return false;
  }
}

function markAvisoAsSeen(aviso) {
  try {
    localStorage.setItem(avisoStorageKey(aviso), "1");
  } catch {}
}

function getAvisoTitulo(aviso) {
  return safe(aviso.titulo || aviso.título || "Aviso");
}

function getAvisoTexto(aviso) {
  return safe(aviso.texto || aviso.mensagem || aviso.descricao || aviso.descrição);
}

function getAvisoLink(aviso) {
  return safe(aviso.link || aviso.url);
}

function getAvisoBotao(aviso) {
  return safe(aviso.botao || aviso.botão || "Acessar");
}

function closeModal() {
  const modalRoot = document.getElementById("modalRoot");
  if (modalRoot) modalRoot.innerHTML = "";
}

function showPopupAviso(aviso, marcarComoVisto = true) {
  const modalRoot = document.getElementById("modalRoot");
  if (!modalRoot) return;

  const titulo = getAvisoTitulo(aviso);
  const mensagem = getAvisoTexto(aviso);
  const link = getAvisoLink(aviso);
  const textoBotao = getAvisoBotao(aviso);

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
              ? `<a id="openAvisoLink" href="${link}" target="_blank" rel="noopener noreferrer" style="
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
    if (marcarComoVisto) markAvisoAsSeen(aviso);
    closeModal();
  });

  const openAvisoLink = document.getElementById("openAvisoLink");

  if (openAvisoLink) {
    openAvisoLink.addEventListener("click", () => {
      if (marcarComoVisto) markAvisoAsSeen(aviso);
    });
  }
}

function showListaAvisos() {
  const modalRoot = document.getElementById("modalRoot");
  if (!modalRoot) return;

  const avisosAtivos = avisosCache.filter((a) => truthy(a.ativo));

  if (!avisosAtivos.length) {
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
          <h2 style="margin:0 0 10px; color:#2e7d32;">🔔 Avisos</h2>
          <p style="margin:0 0 18px; color:#333;">Não há avisos ativos no momento.</p>
          <div style="text-align:right;">
            <button id="closeListaAvisosBtn" style="
              border:none;
              background:#43933C;
              color:#fff;
              border-radius:10px;
              padding:10px 14px;
              font-weight:800;
              cursor:pointer;
            ">Fechar</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("closeListaAvisosBtn").addEventListener("click", closeModal);
    return;
  }

  const listaHtml = avisosAtivos.map((aviso, idx) => {
    const titulo = getAvisoTitulo(aviso);
    const texto = getAvisoTexto(aviso);
    const link = getAvisoLink(aviso);
    const botao = getAvisoBotao(aviso);

    return `
      <div style="
        border:1px solid #e0e0e0;
        border-radius:14px;
        padding:14px;
        margin-bottom:12px;
        background:#f9fbf8;
      ">
        <h3 style="
          margin:0 0 8px;
          color:#2e7d32;
          font-size:17px;
        ">${titulo}</h3>

        <div style="
          color:#222;
          font-size:15px;
          line-height:1.4;
          white-space:pre-line;
        ">${texto}</div>

        ${
          link
            ? `<div style="margin-top:12px;">
                <a href="${link}" target="_blank" rel="noopener noreferrer" style="
                  display:inline-block;
                  background:#43933C;
                  color:#fff;
                  text-decoration:none;
                  border-radius:10px;
                  padding:9px 12px;
                  font-weight:800;
                ">${botao}</a>
              </div>`
            : ""
        }
      </div>
    `;
  }).join("");

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
        width: min(520px, 100%);
        max-height: 86vh;
        overflow: auto;
        border-radius: 18px;
        padding: 22px;
        box-shadow: 0 12px 35px rgba(0,0,0,.25);
        font-family: system-ui, Arial, sans-serif;
      ">
        <h2 style="
          margin: 0 0 14px;
          font-size: 22px;
          color: #2e7d32;
        ">🔔 Avisos</h2>

        ${listaHtml}

        <div style="text-align:right; margin-top:10px;">
          <button id="closeListaAvisosBtn" style="
            border:none;
            background:#43933C;
            color:#fff;
            border-radius:10px;
            padding:10px 14px;
            font-weight:800;
            cursor:pointer;
          ">Fechar</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("closeListaAvisosBtn").addEventListener("click", closeModal);
}

function setupVerAvisosButton() {
  const btn = document.getElementById("verAvisosBtn");
  if (!btn) return;

  const ativos = avisosCache.filter((a) => truthy(a.ativo));

  if (!ativos.length) {
    btn.style.display = "none";
    return;
  }

  btn.style.display = "inline-block";
  btn.addEventListener("click", showListaAvisos);
}

async function loadAvisos() {
  let avisos = [];

  try {
    avisos = await fetchCSV(CSV_URLS.avisos);
  } catch (e) {
    setupVerAvisosButton();
    return;
  }

  avisosCache = avisos
    .filter((a) => truthy(a.ativo))
    .sort((a, b) => numOr(a.ordem) - numOr(b.ordem));

  setupVerAvisosButton();

  const naoVistos = avisosCache.filter((a) => !wasAvisoSeen(a));

  if (!naoVistos.length) return;

  showPopupAviso(naoVistos[0], true);
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

function setupInstallButton() {
  const installBtn = document.getElementById("installBtn");
  if (!installBtn) return;

  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  const isAndroid = /android/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
  const isDesktop = !isAndroid && !isIOS;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (isStandalone) {
    installBtn.style.display = "none";
    return;
  }

  if (isIOS) {
    installBtn.style.display = "inline-block";
    installBtn.textContent = "📲 Instalar no iPhone";
  } else if (isAndroid) {
    installBtn.style.display = "inline-block";
    installBtn.textContent = "📲 Instalar no Android";
  } else if (isDesktop) {
    installBtn.style.display = "inline-block";
    installBtn.textContent = "💻 Instalar no computador";
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;

    if (!isStandalone) {
      installBtn.style.display = "inline-block";

      if (isAndroid) {
        installBtn.textContent = "📲 Instalar no Android";
      } else {
        installBtn.textContent = "💻 Instalar no computador";
      }
    }
  });

  installBtn.addEventListener("click", async () => {
    if (isIOS) {
      window.location.href = "/instalar/";
      return;
    }

    if (!deferredPrompt) {
      window.location.href = "/instalar/";
      return;
    }

    deferredPrompt.prompt();

    await deferredPrompt.userChoice;

    deferredPrompt = null;
    installBtn.style.display = "none";
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installBtn.style.display = "none";
  });
}

function showUpdateButton() {
  const updateBtn = document.getElementById("updateAppBtn");
  if (!updateBtn) return;

  updateBtn.style.display = "inline-block";

  updateBtn.onclick = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } else {
      location.reload();
    }
  };
}

function setupAppUpdate() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    location.reload();
  });

  navigator.serviceWorker.ready.then((registration) => {
    if (registration.waiting) {
      waitingWorker = registration.waiting;
      showUpdateButton();
    }

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          waitingWorker = newWorker;
          showUpdateButton();
        }
      });
    });

    registration.update().catch(() => {});
  });
}

async function load() {
  setupInstallButton();
  setupAppUpdate();

  await loadModulos();
  await loadAvisos();
}

document.addEventListener("DOMContentLoaded", load);
