// Techniques (axes du radar)
const TECHNIQUES = ["LGS", "PHO", "SLAM", "SLS", "GS"];

// Libellés complets à afficher (remplacement des acronymes)
const TECHNIQUE_LABELS = {
  LGS: "Lasergrammétrie statique sur trépied",
  PHO: "Photogrammétrie (multi-images)",
  SLAM: "Scanner mobile (SLAM)",
  SLS: "Scanner à lumière structurée",
  GS: "Gaussian splatting"
};

// Helper pour “1–2”, “3*”, etc.
function normalizeScore(raw) {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const txt = raw.trim();
    if (txt.includes("–")) {
      const parts = txt.split("–").map(Number);
      if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
        return (parts[0] + parts[1]) / 2; // milieu (ex: 1–2 => 1.5)
      }
    }
    const num = parseFloat(txt);
    if (!Number.isNaN(num)) return num;
  }
  return 0;
}

// Critères et scores issus du prompt (valeurs 1..3, avec quelques 1–2, 3*, 3**)
const CRITERIA = [
  {
    id: "grand-volume",
    name: "Bâtiment entier / grand volume",
    scores: { LGS: 2, PHO: 3, SLAM: 3, SLS: 0, GS: "3*" },
    weight: 3, enabled: true
  },
  {
    id: "details-fins",
    name: "Détails fins / sculptures",
    scores: { LGS: 2, PHO: 3, SLAM: 2, SLS: 3, GS: 1 },
    weight: 3, enabled: true
  },
  {
    id: "precision",
    name: "Précision < 1–2 mm",
    scores: { LGS: 3, PHO: 2, SLAM: 1, SLS: 3, GS: 1 },
    weight: 3, enabled: true
  },
  
  {
    id: "materiaux-brillants",
    name: "Matériaux brillants / vitrés",
    scores: { LGS: 2, PHO: 1, SLAM: 2, SLS: 2, GS: 3 },
    weight: 3, enabled: true
  },
  {
    id: "textures-orthos",
    name: "Besoin textures / orthophotos",
    scores: { LGS: 1, PHO: 3, SLAM: 1, SLS: 1, GS: 1 },
    weight: 3, enabled: true
  },
  {
    id: "faible-lumiere",
    name: "Faible lumière / nuit",
    scores: { LGS: 3, PHO: 1, SLAM: 2, SLS: 3, GS: 1 },
    weight: 3, enabled: true
  },
].map(c => ({
  ...c,
  scores: Object.fromEntries(
    Object.entries(c.scores).map(([k, v]) => [k, normalizeScore(v)])
  )
}));

const MAX_PER_CRITERION = 3; // plafond par critère pour normalisation

// État
let criteriaState = structuredClone(CRITERIA);

// DOM
const listEl = document.getElementById("criteriaList");
const resetBtn = document.getElementById("resetBtn");
const rankingList = document.getElementById("rankingList");
const presetButtons = Array.from(document.querySelectorAll('[data-preset]'));

// Popover d'aide (créé à la demande)
let helpPopoverEl = null;
function ensureHelpPopover() {
  if (helpPopoverEl) return helpPopoverEl;
  const el = document.createElement("div");
  el.className = "popover";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "false");
  el.hidden = true;
  el.innerHTML = `
    <div class="title"></div>
    <div class="content"></div>
  `;
  document.body.appendChild(el);
  document.addEventListener("click", (e) => {
    if (!el.hidden && !el.contains(e.target)) {
      hideHelpPopover();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideHelpPopover();
  });
  helpPopoverEl = el;
  return el;
}
function showHelpPopover(anchorEl, title, text) {
  const el = ensureHelpPopover();
  el.querySelector(".title").textContent = title;
  el.querySelector(".content").textContent = text;
  el.hidden = false;
  // Positionnement
  const rect = anchorEl.getBoundingClientRect();
  const margin = 8;
  const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
  // Position par défaut à droite
  let left = rect.right + margin + window.scrollX;
  let top = rect.top + window.scrollY;
  // Ajustements si dépasse l'écran
  const elWidth = Math.min(320, vw * 0.8);
  el.style.width = elWidth + "px";
  if (left + elWidth > window.scrollX + vw) {
    left = rect.left - elWidth - margin + window.scrollX;
  }
  const estimatedHeight = el.offsetHeight || 160;
  if (top + estimatedHeight > window.scrollY + vh) {
    top = window.scrollY + vh - estimatedHeight - margin;
  }
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}
function hideHelpPopover() {
  if (helpPopoverEl) helpPopoverEl.hidden = true;
}
async function loadCriterionHelp(id) {
  try {
    const res = await fetch(`./descriptions/${id}.txt`, { cache: "no-store" });
    if (!res.ok) throw new Error("not ok");
    const txt = await res.text();
    return txt.trim();
  } catch {
    return "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere, est in cursus aliquet, justo arcu pulvinar velit, vitae fermentum risus elit sit amet lectus.";
  }
}

// Construire la liste UI
function renderCriteriaList() {
  listEl.innerHTML = "";
  for (const crit of criteriaState) {
    const row = document.createElement("div");
    row.className = "criterion";
    row.dataset.id = crit.id;

    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.checked = !!crit.enabled;
    enabled.ariaLabel = `Activer le critère ${crit.name}`;
    enabled.addEventListener("change", () => {
      crit.enabled = enabled.checked;
      updateAll();
    });

    const labelWrap = document.createElement("div");
    labelWrap.className = "label";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = crit.name;
    const helpBtn = document.createElement("button");
    helpBtn.type = "button";
    helpBtn.className = "help";
    helpBtn.setAttribute("aria-label", `Aide pour ${crit.name}`);
    helpBtn.textContent = "?";
    helpBtn.addEventListener("click", async (evt) => {
      evt.stopPropagation();
      const txt = await loadCriterionHelp(crit.id);
      showHelpPopover(helpBtn, crit.name, txt);
    });
    labelWrap.append(enabled, name, helpBtn);

    const controls = document.createElement("div");
    controls.className = "controls";
    const range = document.createElement("input");
    range.type = "range";
    range.min = "1";
    range.max = "5";
    range.step = "1";
    range.value = String(crit.weight ?? 3);
    range.ariaLabel = `Pondération pour ${crit.name}`;

    const value = document.createElement("div");
    value.className = "value";
    value.textContent = range.value;

    range.addEventListener("input", () => {
      crit.weight = Number(range.value);
      value.textContent = range.value;
      updateAll();
    });

    controls.append(range, value);
    row.append(labelWrap, controls);
    listEl.appendChild(row);
  }
}

// Calculs
function computeTotals() {
  const totals = Object.fromEntries(TECHNIQUES.map(t => [t, 0]));
  const vetoed = Object.fromEntries(TECHNIQUES.map(t => [t, false]));
  let maxPossible = 0;
  for (const crit of criteriaState) {
    if (!crit.enabled) continue;
    const w = crit.weight ?? 3;
    maxPossible += w * MAX_PER_CRITERION;
    for (const t of TECHNIQUES) {
      const score = crit.scores[t] ?? 0;
      if (score === 0) vetoed[t] = true; // veto: une note 0 annule la solution
      totals[t] += w * score;
    }
  }
  const percents = Object.fromEntries(
    TECHNIQUES.map(t => [
      t,
      vetoed[t] ? 0 : (maxPossible > 0 ? (totals[t] / maxPossible) * 100 : 0)
    ])
  );
  return { totals, percents, maxPossible, vetoed };
}

// Chart.js radar (axes = techniques, dataset unique = “proximité”)
let radar;
function renderRadar(percents) {
  const ctx = document.getElementById("radarChart").getContext("2d");
  const data = TECHNIQUES.map(t => percents[t]);
  const gradient = ctx.createLinearGradient(0, 0, 400, 0);
  gradient.addColorStop(0, "#ff2bd6");
  gradient.addColorStop(1, "#24e0ff");

  const config = {
    type: "radar",
    data: {
      labels: TECHNIQUES.map(t => TECHNIQUE_LABELS[t] ?? t),
      datasets: [{
        label: "Proximité (%)",
        data,
        fill: true,
        backgroundColor: "rgba(255,43,214,0.16)",
        borderColor: gradient,
        borderWidth: 2,
        pointBackgroundColor: "#fff",
        pointBorderColor: "#000",
        pointBorderWidth: 2,
        pointRadius: 3,
      }]
    },
    options: {
      responsive: true,
      scales: {
        r: {
          suggestedMin: 0,
          suggestedMax: 100,
          grid: { color: "rgba(255,255,255,.12)" },
          angleLines: { color: "rgba(255,255,255,.12)" },
          ticks: {
            backdropColor: "transparent",
            color: "#8a9099",
            showLabelBackdrop: false,
            stepSize: 20,
            callback: v => `${v}%`
          },
          pointLabels: {
            color: "#e8ecf1",
            font: { weight: 600 }
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.formattedValue}%`
          }
        }
      }
    }
  };
  if (radar) {
    radar.data.datasets[0].data = data;
    radar.update();
  } else {
    radar = new Chart(ctx, config);
  }
}

function renderRanking(totals, percents, vetoed) {
  const items = TECHNIQUES
    .map(t => ({ t, total: totals[t], pct: percents[t], veto: !!vetoed?.[t] }))
    .sort((a, b) => b.total - a.total);
  rankingList.innerHTML = "";
  for (const { t, total, pct, veto } of items) {
    const li = document.createElement("li");
    const label = TECHNIQUE_LABELS[t] ?? t;
    li.classList.toggle("veto", veto);
    const note = veto ? " — exclu (note 0 sur un critère)" : ` — ${total.toFixed(2)} pts (${pct.toFixed(1)}%)`;
    li.innerHTML = `<strong>${label}</strong> <span class="score">${note}</span>`;
    rankingList.appendChild(li);
  }
}

function updateAll() {
  const { totals, percents, vetoed } = computeTotals();
  renderRadar(percents);
  renderRanking(totals, percents, vetoed);
}

// Presets (pondérations)
const PRESETS = {
  plans: {
    // “Plans & relevés”
    precision: 5,
    "grand-volume": 4,
    "textures-orthos": 2,
    "temps-traitement": 3,
    mouvements: 3,
    "espaces-etroits": 3,
  },
  vr: {
    // “Médiation VR”
    "vr-temps-reel": 5,
    "textures-orthos": 4,
    "grand-volume": 3,
    mobilite: 4,
    "temps-traitement": 2,
  },
  details: {
    // “Détails fins”
    "details-fins": 5,
    precision: 5,
    "materiaux-brillants": 3,
    "textures-orthos": 3,
  },
  site: {
    // “Site occupé”
    "site-occupe": 5,
    mouvements: 4,
    "espaces-etroits": 4,
    "faible-lumiere": 3,
    mobilite: 3,
  }
};

function applyPreset(name) {
  const preset = PRESETS[name];
  if (!preset) return;
  for (const crit of criteriaState) {
    if (preset[crit.id]) {
      crit.weight = preset[crit.id];
    }
    crit.enabled = true;
  }
  // Rafraîchir UI sliders
  for (const row of listEl.querySelectorAll(".criterion")) {
    const id = row.dataset.id;
    const crit = criteriaState.find(c => c.id === id);
    const cb = row.querySelector('input[type="checkbox"]');
    const range = row.querySelector('input[type="range"]');
    const val = row.querySelector('.value');
    if (cb) cb.checked = crit.enabled;
    if (range) range.value = String(crit.weight ?? 3);
    if (val) val.textContent = range.value;
  }
  updateAll();
}

// Reset
function resetAll() {
  criteriaState = CRITERIA.map(c => ({ ...c, weight: 3, enabled: true }));
  renderCriteriaList();
  updateAll();
}

// Init
renderCriteriaList();
resetBtn?.addEventListener("click", resetAll);
presetButtons.forEach(btn => {
  btn.addEventListener("click", () => applyPreset(btn.dataset.preset));
});
updateAll();


