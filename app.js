const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSr4o5yxLQTP-MxL_gBjHC2LqsMbV8LdxlmOUG3VhGVUPMOy9m6n4pCMor4ghtHtDmLOYfkvGdIKCEA/pub?gid=1651715340&single=true&output=csv";

function parseCSV(text) {
  // Parser simples: suporta campos com aspas e vírgulas dentro das aspas.
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      // aspas escapadas ""
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (cur.length || row.length) {
        row.push(cur);
        rows.push(row);
      }
      row = [];
      cur = "";
      // pular \r\n
      if (ch === "\r" && next === "\n") i++;
      continue;
    }

    cur += ch;
  }

  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }

  return rows;
}

fetch(CSV_URL, { cache: "no-store" })
  .then(res => res.text())
  .then(text => {
    const data = parseCSV(text);
    const header = data[0].map(h => (h || "").trim().toLowerCase());

    const idx = {
      modulo: header.indexOf("modulo"),
      url: header.indexOf("url"),
      ativo: header.indexOf("ativo"),
      ordem: header.indexOf("ordem"),
    };

    const modules = new Map();

    for (let r = 1; r < data.length; r++) {
      const cols = data[r];
      const modulo = (cols[idx.modulo] || "").trim();
      const url = (cols[idx.url] || "").trim();
      const ativoRaw = (cols[idx.ativo] || "").trim().toUpperCase();
      const ordem = parseInt((cols[idx.ordem] || "9999").trim(), 10);

      if (!modulo) continue;
      if (!url) continue;
      if (ativoRaw !== "TRUE") continue;

      // manter o primeiro link por módulo, priorizando menor ordem
      if (!modules.has(modulo) || ordem < modules.get(modulo).ordem) {
        modules.set(modulo, { url, ordem });
      }
    }

    const container = document.getElementById("modules");
    container.innerHTML = "";

    // ordenar por ordem (e depois nome)
    const ordered = Array.from(modules.entries())
      .sort((a, b) => (a[1].ordem - b[1].ordem) || a[0].localeCompare(b[0], "pt-BR"));

    ordered.forEach(([mod, info]) => {
      const card = document.createElement("div");
      card.className = "card";
      card.textContent = mod;
      card.onclick = () => window.open(info.url, "_blank");
      container.appendChild(card);
    });
  })
  .catch(err => {
    console.error("Erro ao carregar catálogo:", err);
  });
