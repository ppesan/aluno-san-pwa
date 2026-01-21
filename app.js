const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSr4o5yxLQTP-MxL_gBjHC2LqsMbV8LdxlmOUG3VhGVUPMOy9m6n4pCMor4ghtHtDmLOYfkvGdIKCEA/pub?gid=1651715340&single=true&output=csv";

fetch(CSV_URL)
  .then(res => res.text())
  .then(text => {
    const lines = text.split("\n").slice(1);
    const modules = {};

    lines.forEach(line => {
      const cols = line.split(",");
      const modulo = cols[1];
      const titulo = cols[2];
      const url = cols[9];
      const ativo = cols[11]?.trim();

      if (ativo !== "TRUE") return;

      if (!modules[modulo]) {
        modules[modulo] = url;
      }
    });

    const container = document.getElementById("modules");

    Object.keys(modules).forEach(mod => {
      const card = document.createElement("div");
      card.className = "card";
      card.textContent = mod;
      card.onclick = () => window.open(modules[mod], "_blank");
      container.appendChild(card);
    });
  });
