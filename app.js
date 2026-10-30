/**
 * ============================================================================
 * Centria Talent & Succession Intelligence — Frontend Executive Application
 * ============================================================================
 * - Dashboard Ejecutivo Vivo como vista principal por defecto:
 *   4 KPIs interactivos, Matriz 9-Box interactiva y 4 gráficos Chart.js en vivo
 *   conectados en tiempo real al documento `2026_Reporte_Sucesion.xlsx`.
 * - UX/UI Limpio: El Agente IA se invoca EXCLUSIVAMENTE desde el botón flotante
 *   inferior derecho (#btn-fab-chat).
 * - Gestión de Sesión Efímera: Saludo breve al abrir, borrado automático de
 *   sesión al cerrar/minimizar y botón "Nueva sesión" (#btn-new-session).
 * - Validador DOMParser de estructura HTML para respuestas del LLM, con
 *   excepción automática para respuestas lineales/conversacionales breves.
 * - 100% compatible con publicación estática en GitHub Pages y servidor FastAPI.
 */

// ============================================================================
// MÓDULO CENTRALIZADO DE TEMA Y COMPONENTES BRECA (Conectado a :root en style.css)
// ============================================================================
const BRECA_THEME = {
  getCssToken(varName, fallback) {
    if (typeof window === "undefined" || !document.documentElement) return fallback;
    const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return val || fallback;
  },

  getPalette() {
    return {
      gray: this.getCssToken("--breca-gray", "rgb(178, 177, 177)"),
      slate: this.getCssToken("--breca-slate", "rgb(101, 103, 107)"),
      charcoal: this.getCssToken("--breca-charcoal", "rgb(29, 36, 44)"),
      black: this.getCssToken("--breca-black", "rgb(0, 0, 0)"),
      sage: this.getCssToken("--breca-sage", "rgb(77, 111, 97)"),
      teal: this.getCssToken("--breca-teal", "rgb(70, 112, 128)"),
      petrol: this.getCssToken("--breca-petrol", "rgb(0, 94, 133)"),
      gold: this.getCssToken("--breca-gold", "rgb(242, 183, 5)"),
      borderDefault: this.getCssToken("--breca-border-default", "rgb(213, 214, 216)"),
      borderSubtle: this.getCssToken("--breca-border-subtle", "rgb(230, 231, 232)"),
      divider: this.getCssToken("--breca-border-subtle", "rgb(230, 231, 232)"),
      surface: this.getCssToken("--breca-bg-surface", "rgb(255, 255, 255)"),
    };
  },

  createChartOptions({
    stacked = false,
    onClick = null,
    isDoughnut = false,
    cutout = "62%",
    xMax = undefined,
    legendPosition = "bottom",
    legendPadding = 14,
    tooltipCallbacks = undefined,
    xTickCallback = undefined,
    yFontSize = 11,
    xGridDisplay = false,
    yGridDisplay = true,
  } = {}) {
    const p = this.getPalette();
    const base = {
      responsive: true,
      maintainAspectRatio: false,
      onClick: onClick || undefined,
      plugins: {
        legend: {
          position: legendPosition,
          labels: {
            boxWidth: 11,
            usePointStyle: true,
            padding: legendPadding,
            font: { family: "Inter", size: 11, weight: "600" },
            color: p.charcoal,
          },
        },
        tooltip: {
          backgroundColor: p.charcoal,
          titleFont: { family: "Inter", size: 12, weight: "700" },
          bodyFont: { family: "Inter", size: 11 },
          padding: 10,
          cornerRadius: 8,
          callbacks: tooltipCallbacks,
        },
      },
    };

    if (isDoughnut) {
      base.cutout = cutout;
      return base;
    }

    base.scales = {
      x: {
        stacked,
        max: xMax,
        grid: {
          display: xGridDisplay,
          color: p.borderSubtle,
        },
        ticks: {
          font: { family: "Inter", size: 11, weight: xGridDisplay ? "500" : "700" },
          color: xGridDisplay ? p.slate : p.charcoal,
          callback: xTickCallback,
        },
      },
      y: {
        stacked,
        beginAtZero: true,
        grid: {
          display: yGridDisplay,
          color: p.borderSubtle,
        },
        ticks: {
          precision: 0,
          font: { family: "Inter", size: yFontSize, weight: yGridDisplay ? "500" : "700" },
          color: yGridDisplay ? p.slate : p.charcoal,
        },
      },
    };
    return base;
  },

  ui: {
    statTile({ variant = "neutral", label, value, subtext, dataAttr = "", title = "" }) {
      const tileVariant = `breca-stat-tile-${variant}`;
      const valueColor =
        variant === "sage"
          ? "text-breca-sage"
          : variant === "petrol"
          ? "text-breca-petrol"
          : variant === "teal"
          ? "text-breca-teal"
          : "text-breca-charcoal";
      return `
        <button type="button" ${dataAttr} class="breca-stat-tile ${tileVariant}" ${title ? `title="${title}"` : ""}>
          <div class="text-[10px] font-bold uppercase tracking-wider text-breca-slate truncate">${label}</div>
          <div class="text-base font-extrabold ${valueColor} tabular-nums mt-0.5">${value}</div>
          <div class="text-[10px] font-medium text-breca-slate mt-0.5 truncate">${subtext}</div>
        </button>
      `;
    },

    riskBadge(riesgo) {
      if (riesgo === "Alto") {
        return `<span class="breca-pill breca-pill-charcoal"><span class="w-1.5 h-1.5 rounded-full bg-white"></span>Alto</span>`;
      }
      if (riesgo === "Medio") {
        return `<span class="breca-pill breca-pill-teal"><span class="w-1.5 h-1.5 rounded-full bg-breca-teal"></span>Medio</span>`;
      }
      return `<span class="breca-pill breca-pill-sage"><span class="w-1.5 h-1.5 rounded-full bg-breca-sage"></span>Bajo</span>`;
    },

    readinessBadge(readiness, hasSucc) {
      if (!hasSucc) {
        return `<span class="breca-pill breca-pill-sm breca-pill-charcoal">Brecha de Sucesión</span>`;
      }
      if (readiness === "Inmediato") {
        return `<span class="breca-pill breca-pill-sm breca-pill-sage">Ready Now (Inmediato)</span>`;
      }
      if (readiness === "1 a 3 años") {
        return `<span class="breca-pill breca-pill-sm breca-pill-petrol">1 a 3 años</span>`;
      }
      if (readiness === "3 a 5 años") {
        return `<span class="breca-pill breca-pill-sm breca-pill-teal">3 a 5 años</span>`;
      }
      return `<span class="breca-pill breca-pill-sm breca-pill-neutral">${escapeHtml(readiness)}</span>`;
    },
  },
};
window.BRECA_THEME = BRECA_THEME;

const state = {
  records: [],
  filteredRecords: [],
  companies: [],
  ggsList: [],
  selectedCompany: "ALL",
  searchQuery: "",
  filterRisk: "ALL",
  filter9Box: "ALL",
  filterReadiness: "ALL",
  filterCritical: "ALL",
  filterGGS: "ALL",
  activePreset: null,
  activeKpiFilter: "ALL",
  currentPage: 1,
  pageSize: 12,
  activeTab: "analytics",
  drawerExpanded: false,
  quickActionsCollapsed: true,
  quickActionsMode: "templates",
  chatHistory: [],
  canvasArtifacts: [],
  activeArtifactId: "HOME",
  mobileWorkspaceTab: "chat",
  activeFichaRecord: null,
};

// Instancias vivas de Chart.js para actualización reactiva desde el documento
const chartInstances = {
  riskCoverage: null,
  readinessPipeline: null,
  levelCritical: null,
  companyHealth: null,
};

// 6 Plantillas Ejecutivas de Reporte (Caso mayoritario: Fichas, Comparaciones y Tablas)
const QUICK_ACTIONS = [
  {
    id: "qa-1",
    category: "Ficha Individual",
    shortLabel: "Ficha ejecutiva de Javier Carvalho",
    icon: "👤",
    routeType: "TEMPLATE",
    question: "Genera la ficha ejecutiva de Javier Carvalho.",
  },
  {
    id: "qa-2",
    category: "Comparación Cruzada",
    shortLabel: "Raúl Chávez vs Alonso Salazar",
    icon: "⚖️",
    routeType: "TEMPLATE",
    question: "Compara a Raúl Chávez de Centria con Alonso Salazar de Qroma.",
  },
  {
    id: "qa-3",
    category: "Alerta de Retención",
    shortLabel: "Riesgo Alto sin Sucesor",
    icon: "🚨",
    routeType: "TEMPLATE",
    question: "¿Qué talentos tienen riesgo alto de pérdida y no cuentan con sucesor?",
  },
  {
    id: "qa-4",
    category: "Comité de Talento",
    shortLabel: "Resumen Ejecutivo de Riesgos y Brechas",
    icon: "📊",
    routeType: "TEMPLATE",
    question: "Genera un resumen ejecutivo de los principales riesgos y brechas de sucesión para el Comité de Talento.",
  },
  {
    id: "qa-5",
    category: "Contraste de Cobertura",
    shortLabel: "Katia Mendoza vs Patricio Vargas",
    icon: "🔄",
    routeType: "TEMPLATE",
    question: "Compara la cobertura de sucesión de Katia Mendoza y Patricio Vargas.",
  },
  {
    id: "qa-6",
    category: "Cobertura Lista",
    shortLabel: "Sucesores con Readiness Inmediato",
    icon: "🟢",
    routeType: "TEMPLATE",
    question: "¿Qué talentos tienen un sucesor con readiness inmediato?",
  },
];

// 6 Preguntas Abiertas de Análisis Profundo y Estrategia (Enrutadas a OPEN_ANALYSIS · Gemini IA)
const OPEN_ANALYSIS_ACTIONS = [
  {
    id: "oa-1",
    category: "Plan de Retención IA",
    icon: "🧠",
    routeType: "OPEN_ANALYSIS",
    question: "¿Qué plan de acción y estrategia de retención recomiendas para mitigar los riesgos críticos del Grupo Breca?",
  },
  {
    id: "oa-2",
    category: "Asesoría de Caso",
    icon: "🎯",
    routeType: "OPEN_ANALYSIS",
    question: "Analiza a fondo el caso de Javier Carvalho: ¿por qué es riesgoso su descalce de sucesión y qué acciones sugieres?",
  },
  {
    id: "oa-3",
    category: "Vulnerabilidad (IVS)",
    icon: "🏢",
    routeType: "OPEN_ANALYSIS",
    question: "¿Cuáles son las empresas más vulnerables del Grupo Breca ante una fuga repentina de talento y por qué?",
  },
  {
    id: "oa-4",
    category: "Motivación Sucesores",
    icon: "💡",
    routeType: "OPEN_ANALYSIS",
    question: "¿Cómo impacta la motivación de los sucesores en la efectividad real del plan de sucesión?",
  },
  {
    id: "oa-5",
    category: "Movilidad Transversal",
    icon: "🔀",
    routeType: "OPEN_ANALYSIS",
    question: "¿Cómo podemos cubrir las posiciones críticas sin sucesor utilizando talento de otras empresas del Grupo Breca?",
  },
  {
    id: "oa-6",
    category: "Antigüedad vs Riesgo",
    icon: "⏳",
    routeType: "OPEN_ANALYSIS",
    question: "Analiza la relación entre el tiempo en la posición actual, el riesgo de pérdida y el estancamiento de sucesión.",
  },
];

// Catálogo completo de 33 consultas (27 Plantillas de Reporte + 6 Análisis Abiertos Gemini IA)
const QUESTION_CATALOG = [
  {
    category: "1. Fichas Individuales — Plantilla de Reporte (5 consultas)",
    items: [
      "Genera la ficha ejecutiva de Javier Carvalho de Corporación Breca.",
      "Muéstrame la información de Raúl Chávez de Centria.",
      "Resume la situación de talento y sucesión de Alonso Salazar de Qroma.",
      "¿Cuál es el riesgo de pérdida, 9Box y situación de sucesión de Roxana León de Aporta?",
      "¿Fiorella Benavides de Clínica Internacional cuenta con un sucesor preparado?",
    ],
  },
  {
    category: "2. Comparaciones Cruzadas — Plantilla de Reporte (5 consultas)",
    items: [
      "Compara a Raúl Chávez de Centria con Alonso Salazar de Qroma considerando GGS, 9Box, riesgo de pérdida y sucesión.",
      "Compara a Katia Mendoza de Corporación Breca con Patricio Vargas de Minsur.",
      "Compara a Valeria Díaz de Tasa con Nadia Maldonado de Clínica Internacional.",
      "Compara a Santiago Alvarado de Qroma con Gabriela Reyes de Centria.",
      "Compara la situación de sucesión de Luciana Escobar de Tasa y Cecilia Flores de Centria.",
    ],
  },
  {
    category: "3. Análisis de Riesgos y Brechas — Plantilla de Reporte (6 consultas)",
    items: [
      "¿Qué talentos presentan riesgo alto de pérdida y no tienen sucesor?",
      "¿Qué talentos tienen riesgo alto y un sucesor preparado en más de tres años?",
      "¿Qué cargos de valor no cuentan con sucesor?",
      "¿Qué posiciones tienen cobertura de sucesión inmediata?",
      "¿Qué posiciones tienen sucesores con readiness superior a cinco años?",
      "¿Qué talentos tienen 9Box 8 o 9 y no cuentan con sucesor?",
    ],
  },
  {
    category: "4. Consultas Filtro por Empresa — Plantilla de Reporte (6 consultas)",
    items: [
      "Genera un resumen de los talentos registrados en Centria.",
      "¿Cuáles son los principales riesgos de talento identificados en Qroma?",
      "¿Qué talentos de Aporta no cuentan con sucesor?",
      "¿Qué posiciones de Corporación Breca tienen cobertura inmediata de sucesión?",
      "Compara la situación de sucesión de Centria y Corporación Breca.",
      "¿Qué talentos de Minsur tienen 9Box 8 o 9?",
    ],
  },
  {
    category: "5. Informes Ejecutivos para el Comité — Plantilla de Reporte (5 consultas)",
    items: [
      "Genera un resumen ejecutivo de los principales riesgos de talento y sucesión.",
      "Identifica las posiciones que requieren atención prioritaria por riesgo alto y ausencia de sucesor.",
      "Resume los talentos con 9Box alto y brechas de sucesión.",
      "Prepara los principales hallazgos del reporte para el Comité de Talento.",
      "Identifica las posiciones críticas con cobertura inmediata, cobertura en desarrollo y sin cobertura.",
    ],
  },
  {
    category: "6. Preguntas Abiertas de Análisis Profundo y Estrategia — Gemini IA (6 consultas)",
    items: [
      "¿Qué plan de acción y estrategia de retención recomiendas para mitigar los riesgos críticos del Grupo Breca?",
      "Analiza a fondo el caso de Javier Carvalho: ¿por qué es riesgoso su descalce de sucesión y qué acciones sugieres?",
      "¿Cuáles son las empresas más vulnerables del Grupo Breca ante una fuga repentina de talento y por qué?",
      "¿Cómo impacta la motivación de los sucesores en la efectividad real del plan de sucesión?",
      "¿Cómo podemos cubrir las posiciones críticas sin sucesor utilizando talento de otras empresas del Grupo Breca?",
      "Analiza la relación entre el tiempo en la posición actual, el riesgo de pérdida y el estancamiento de sucesión.",
    ],
  },
];

// Metadata semántica modular de los 9 cuadrantes 9-Box (Clases de style.css)
const NINE_BOX_META = {
  9: { name: "Estrella / Top Talent", short: "Top Talent", badgeClass: "ninebox-badge-top", cellClass: "ninebox-cell-top" },
  8: { name: "Alto Potencial", short: "Alto Potencial", badgeClass: "ninebox-badge-high", cellClass: "ninebox-cell-high" },
  7: { name: "Enigma / Potencial", short: "Enigma", badgeClass: "ninebox-badge-core", cellClass: "ninebox-cell-core" },
  6: { name: "Futuro Líder", short: "Futuro Líder", badgeClass: "ninebox-badge-sage", cellClass: "ninebox-cell-sage" },
  5: { name: "Talento Clave (Core)", short: "Talento Clave", badgeClass: "ninebox-badge-core", cellClass: "ninebox-cell-core" },
  4: { name: "Profesional Confiable", short: "Confiable", badgeClass: "ninebox-badge-muted", cellClass: "ninebox-cell-muted" },
  3: { name: "Especialista Efectivo", short: "Especialista", badgeClass: "ninebox-badge-core", cellClass: "ninebox-cell-core" },
  2: { name: "En Observación", short: "Observación", badgeClass: "ninebox-badge-muted", cellClass: "ninebox-cell-muted" },
  1: { name: "Bajo Desempeño", short: "Bajo Desemp.", badgeClass: "ninebox-badge-low", cellClass: "ninebox-cell-low" },
};

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getInitials(name) {
  const parts = String(name || "").trim().split(/\s+/);
  if (parts.length === 0) return "TL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hasSuccessorRecord(r) {
  if (typeof r.tiene_sucesor_bool === "boolean") return r.tiene_sucesor_bool;
  if (typeof r.tiene_sucesor === "boolean") return r.tiene_sucesor;
  const ts = String(r.tiene_sucesor || "").trim().toLowerCase();
  if (ts === "no" || ts === "false") return false;
  const s = String(r.sucesor || "").trim().toLowerCase();
  return s !== "" && s !== "sin sucesor" && s !== "-" && s !== "sin cobertura" && s !== "no tiene" && s !== "ninguno";
}

function normalizeClientRecords(rawRecords) {
  return rawRecords.map((r, idx) => {
    const ggsNum = parseInt(String(r.ggs ?? "15").replace(/\D/g, ""), 10) || 15;
    const boxNum = parseInt(String(r.nine_box ?? r["9box"] ?? "5").replace(/\D/g, ""), 10) || 5;
    const suc = String(r.sucesor ?? "Sin sucesor").trim() || "Sin sucesor";
    const tieneSucBool =
      String(r.tiene_sucesor ?? "Sí").toLowerCase() !== "no" &&
      suc.toLowerCase() !== "sin sucesor" &&
      suc !== "-";
    let readiness = String(r.readiness ?? "Sin cobertura").trim();
    if (!tieneSucBool || readiness === "-") readiness = "Sin cobertura";

    const cargoValor = ["sí", "si", "yes", "true", "1"].includes(String(r.cargo_valor ?? "").trim().toLowerCase())
      ? "Sí"
      : "No";
    let riesgo = String(r.riesgo ?? "Medio").trim();
    if (!["Alto", "Medio", "Bajo"].includes(riesgo)) {
      const rl = riesgo.toLowerCase();
      riesgo = rl.includes("alt") ? "Alto" : rl.includes("baj") ? "Bajo" : "Medio";
    }

    const fullName =
      String(r.nombre_completo || "").trim() ||
      [String(r.nombre_corto || "").trim(), String(r.apellidos || "").trim()].filter(Boolean).join(" ").trim() ||
      String(r.nombre || "").trim();
    const parts = fullName.split(/\s+/);
    const firstName = String(r.nombre_corto || parts[0] || "").trim();
    const lastName = String(r.apellidos || parts.slice(1).join(" ") || "").trim();

    return {
      id: r.id || idx + 1,
      fila_excel: r.fila_excel || idx + 2,
      documento: String(r.documento ?? `4000${String(idx + 1).padStart(4, "0")}`).trim(),
      empresa: String(r.empresa ?? "Centria").trim(),
      nombre: fullName,
      nombre_corto: firstName,
      apellidos: lastName,
      nombre_completo: fullName,
      posicion: String(r.posicion ?? "").trim(),
      nivel: String(r.nivel ?? "N-2").trim(),
      ggs: ggsNum,
      ggs_label: `GGS ${ggsNum}`,
      tiempo_posicion: String(r.tiempo_posicion ?? "2 años, 0 meses").trim(),
      cargo_valor: cargoValor,
      nine_box: boxNum,
      nine_box_label: `9Box ${boxNum}`,
      riesgo,
      sucesor: tieneSucBool ? suc : "Sin sucesor",
      tiene_sucesor: tieneSucBool ? "Sí" : "No",
      tiene_sucesor_bool: tieneSucBool,
      readiness,
      motivacion_sucesor: tieneSucBool ? String(r.motivacion_sucesor ?? "-").trim() : "-",
    };
  });
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
document.addEventListener("DOMContentLoaded", async () => {
  if (window.marked) {
    window.marked.setOptions({ gfm: true, breaks: true });
  }

  bindEventListeners();
  renderQuickActions();
  renderQuestionCatalog();
  startNewChatSession();
  switchTab("analytics");

  await loadInitialData();
});

async function loadInitialData() {
  // Carga instantánea de los 101 registros oficiales desde los datos embebidos (100% estático)
  const initial = Array.isArray(window.CENTRIA_INITIAL_DATA) ? window.CENTRIA_INITIAL_DATA : [];
  state.records = normalizeClientRecords(initial);
  refreshMetadataLists();
  applyFiltersAndRender();
  updateDrawerBadge();
}

function updateDrawerBadge() {
  const drawerBadge = document.getElementById("drawer-engine-badge");
  if (drawerBadge) {
    drawerBadge.textContent = `Conectado en vivo · ${state.records.length || 101} posiciones`;
  }
  const headerLiveBadge = document.getElementById("header-live-doc-badge");
  if (headerLiveBadge) {
    if (state.selectedCompany === "ALL") {
      headerLiveBadge.textContent = `${state.records.length || 101} posiciones en vivo`;
    } else {
      const subCount = state.records.filter((r) => r.empresa === state.selectedCompany).length;
      headerLiveBadge.textContent = `${subCount} posiciones · ${state.selectedCompany}`;
    }
  }
}

function refreshMetadataLists() {
  const companiesSet = new Set(state.records.map((r) => r.empresa).filter(Boolean));
  state.companies = Array.from(companiesSet).sort();

  const ggsSet = new Set(state.records.map((r) => r.ggs).filter(Boolean));
  state.ggsList = Array.from(ggsSet).sort((a, b) => a - b);

  const companySelect = document.getElementById("global-company-select");
  if (companySelect) {
    const current = state.selectedCompany;
    companySelect.innerHTML = `<option value="ALL" class="text-breca-charcoal font-semibold">Todas las Empresas (${state.records.length})</option>`;
    state.companies.forEach((comp) => {
      const count = state.records.filter((r) => r.empresa === comp).length;
      const opt = document.createElement("option");
      opt.value = comp;
      opt.className = "text-breca-charcoal";
      opt.textContent = `${comp} (${count})`;
      companySelect.appendChild(opt);
    });
    companySelect.value = state.companies.includes(current) ? current : "ALL";
  }
}

// ============================================================================
// FILTRADO REACTIVO Y RENDERIZADO COORDINADO
// ============================================================================
function applyFiltersAndRender() {
  const q = state.searchQuery.trim().toLowerCase();

  state.filteredRecords = state.records.filter((r) => {
    if (state.selectedCompany !== "ALL" && r.empresa !== state.selectedCompany) return false;
    if (state.filterRisk !== "ALL" && r.riesgo !== state.filterRisk) return false;

    if (state.filter9Box !== "ALL") {
      if (state.filter9Box === "TOP") {
        if (r.nine_box < 8) return false;
      } else if (String(r.nine_box) !== String(state.filter9Box)) {
        return false;
      }
    }

    if (state.filterReadiness !== "ALL") {
      if (state.filterReadiness === "WITH_SUCCESSOR" && !hasSuccessorRecord(r)) return false;
      if (state.filterReadiness === "NO_SUCCESSOR" && hasSuccessorRecord(r)) return false;
      if (state.filterReadiness === "OVER_3_YEARS" && !["3 a 5 años", "+ de 5 años"].includes(r.readiness)) return false;
      if (
        !["WITH_SUCCESSOR", "NO_SUCCESSOR", "OVER_3_YEARS"].includes(state.filterReadiness) &&
        r.readiness !== state.filterReadiness
      ) {
        return false;
      }
    }

    if (state.filterCritical !== "ALL" && r.cargo_valor !== state.filterCritical) return false;
    if (state.filterGGS !== "ALL" && String(r.ggs) !== String(state.filterGGS)) return false;

    if (q) {
      const haystack = [
        r.nombre,
        r.empresa,
        r.posicion,
        r.nivel,
        r.ggs_label,
        r.nine_box_label,
        r.riesgo,
        r.sucesor,
        r.readiness,
        r.motivacion_sucesor,
        r.documento,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(state.filteredRecords.length / state.pageSize));
  if (state.currentPage > totalPages) state.currentPage = 1;

  renderKPIs();
  renderTable();
  renderAnalyticsDashboard();
  updateFilterHighlights();
  updateDrawerBadge();
}

function updateFilterHighlights() {
  const kpiMap = {
    ALL: "kpi-card-all",
    NO_SUCCESSOR: "kpi-card-coverage",
    READY_NOW: "kpi-card-ready",
    CRITICAL_RISK: "kpi-card-critical",
  };
  Object.entries(kpiMap).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (state.activeKpiFilter === key && key !== "ALL") {
      el.classList.add("kpi-card-active");
    } else {
      el.classList.remove("kpi-card-active");
    }
  });

  document.querySelectorAll(".preset-filter-btn").forEach((btn) => {
    const preset = btn.getAttribute("data-preset");
    if (preset && preset === state.activePreset) {
      btn.classList.add("preset-chip-active");
    } else {
      btn.classList.remove("preset-chip-active");
    }
  });
}

// ============================================================================
// RENDERIZADO DE LAS 4 TARJETAS KPI EJECUTIVAS
// ============================================================================
function renderKPIs() {
  const scopeRecords =
    state.selectedCompany === "ALL"
      ? state.records
      : state.records.filter((r) => r.empresa === state.selectedCompany);

  const total = scopeRecords.length;
  const criticalCount = scopeRecords.filter((r) => r.cargo_valor === "Sí").length;
  const criticalPct = total ? ((criticalCount / total) * 100).toFixed(1) : "0.0";

  const withSuccessor = scopeRecords.filter((r) => hasSuccessorRecord(r)).length;
  const withoutSuccessor = total - withSuccessor;
  const coveragePct = total ? ((withSuccessor / total) * 100).toFixed(1) : "0.0";

  const readyNow = scopeRecords.filter((r) => r.readiness === "Inmediato").length;
  const readyPct = total ? ((readyNow / total) * 100).toFixed(1) : "0.0";

  const topTalent = scopeRecords.filter((r) => r.nine_box >= 8).length;
  const topTalentPct = total ? ((topTalent / total) * 100).toFixed(1) : "0.0";

  const highRisk = scopeRecords.filter((r) => r.riesgo === "Alto").length;
  const highRiskNoSucc = scopeRecords.filter((r) => r.riesgo === "Alto" && !hasSuccessorRecord(r)).length;

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt("kpi-total", total);
  setTxt("kpi-critical", criticalCount);
  setTxt("kpi-critical-pct", `${criticalPct}%`);

  const companyBadge = document.getElementById("kpi-company-badge");
  if (companyBadge) {
    companyBadge.textContent =
      state.selectedCompany === "ALL" ? `· ${state.companies.length} empresas` : `· ${state.selectedCompany}`;
  }

  setTxt("kpi-coverage", `${coveragePct}%`);
  const covSub = document.getElementById("kpi-coverage-sub");
  if (covSub) {
    covSub.innerHTML = `${withSuccessor} con sucesor · <span class="breca-kpi-highlight">${withoutSuccessor} sin sucesor</span>`;
  }

  setTxt("kpi-ready-now", readyNow);
  setTxt("kpi-ready-pct", `${readyPct}% Ready Now`);
  setTxt("kpi-top-talent", topTalent);
  setTxt("kpi-top-talent-sub", `${topTalentPct}%`);

  setTxt("kpi-high-risk", highRisk);
  setTxt("kpi-critical-no-succ", `${highRiskNoSucc} en riesgo alto sin sucesor`);
  setTxt("table-count-pill", state.filteredRecords.length);
  setTxt("header-table-count", state.filteredRecords.length);

  // Actualizar dinámicamente los contadores de los 5 filtros rápidos (Presets) según el alcance activo
  const criticalNoSuccCount = scopeRecords.filter((r) => r.cargo_valor === "Sí" && !hasSuccessorRecord(r)).length;
  const top9BoxNoSuccCount = scopeRecords.filter((r) => r.nine_box >= 8 && !hasSuccessorRecord(r)).length;
  const highRiskOver3yCount = scopeRecords.filter(
    (r) => r.riesgo === "Alto" && ["3 a 5 años", "+ de 5 años"].includes(r.readiness)
  ).length;

  const presetLabels = {
    "high-risk-no-successor": `Riesgo Alto Sin Sucesor (${highRiskNoSucc})`,
    "critical-no-successor": `Cargos de Valor Sin Sucesor (${criticalNoSuccCount})`,
    "ready-now": `Sucesión Inmediata (${readyNow})`,
    "top-9box-no-successor": `9-Box 8/9 Sin Sucesor (${top9BoxNoSuccCount})`,
    "high-risk-over-3y": `Riesgo Alto + Readiness >3a (${highRiskOver3yCount})`,
  };
  document.querySelectorAll(".preset-filter-btn").forEach((btn) => {
    const presetKey = btn.getAttribute("data-preset");
    if (presetKey && presetLabels[presetKey]) {
      const span = btn.querySelector("span") || btn;
      span.textContent = presetLabels[presetKey];
    }
  });
}

// ============================================================================
// RENDERIZADO DEL DASHBOARD ANALÍTICO EN VIVO (CHART.JS + 9-BOX + ALERTAS)
// ============================================================================
function renderAnalyticsDashboard() {
  const scope =
    state.selectedCompany === "ALL"
      ? state.records
      : state.records.filter((r) => r.empresa === state.selectedCompany);

  const total = scope.length || 1;

  // 1. Matriz 9-Box Interactiva
  const matrixEl = document.getElementById("ninebox-matrix-container");
  if (matrixEl) {
    const order = [7, 8, 9, 4, 5, 6, 1, 2, 3];
    matrixEl.innerHTML = order
      .map((box) => {
        const meta = NINE_BOX_META[box];
        const count = scope.filter((r) => r.nine_box === box).length;
        const pct = ((count / total) * 100).toFixed(1);
        const noSucc = scope.filter((r) => r.nine_box === box && !hasSuccessorRecord(r)).length;
        const isActive = String(state.filter9Box) === String(box);

        return `
          <button
            type="button"
            data-9box-cell="${box}"
            class="ninebox-cell ${meta.cellClass} ${isActive ? "ninebox-cell-active" : ""}"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="text-xs font-extrabold uppercase tracking-wider opacity-80">Cuadrante ${box}</span>
              <span class="ninebox-pct-pill">${pct}%</span>
            </div>
            <div class="my-2">
              <div class="text-3xl font-extrabold tabular-nums leading-none">${count}</div>
              <div class="text-xs font-bold mt-1.5 truncate">${meta.name}</div>
            </div>
            <div class="text-[11px] opacity-85 font-semibold pt-1 border-t border-breca-divider">
              ${noSucc > 0 ? `${noSucc} sin sucesor` : `Cobertura completa`}
            </div>
          </button>
        `;
      })
      .join("");
  }

  // 2. Actualizar los 4 Gráficos Vivos en Chart.js
  updateLiveCharts(scope);

  // 2.b Poblar resúmenes ejecutivos debajo de los 4 gráficos vivos (Componentes Modulares BRECA_THEME.ui)
  const riskDistEl = document.getElementById("risk-distribution-container");
  if (riskDistEl) {
    const riskItems = [
      { label: "Riesgo Alto", key: "Alto", variant: "charcoal" },
      { label: "Riesgo Medio", key: "Medio", variant: "teal" },
      { label: "Riesgo Bajo", key: "Bajo", variant: "sage" },
    ];
    riskDistEl.innerHTML = riskItems
      .map((item) => {
        const cnt = scope.filter((r) => r.riesgo === item.key).length;
        const pct = ((cnt / total) * 100).toFixed(1);
        const noSucc = scope.filter((r) => r.riesgo === item.key && !hasSuccessorRecord(r)).length;
        return BRECA_THEME.ui.statTile({
          variant: item.variant,
          label: item.label,
          value: `${cnt} (${pct}%)`,
          subtext: `${noSucc} sin sucesor`,
          dataAttr: `data-quick-risk="${item.key}"`,
        });
      })
      .join("");
  }

  const readinessDistEl = document.getElementById("readiness-distribution-container");
  if (readinessDistEl) {
    const rdItems = [
      { label: "Inmediato", count: scope.filter((r) => hasSuccessorRecord(r) && r.readiness === "Inmediato").length, variant: "sage" },
      { label: "1 a 3 años", count: scope.filter((r) => hasSuccessorRecord(r) && r.readiness === "1 a 3 años").length, variant: "petrol" },
      { label: "3 a 5 años", count: scope.filter((r) => hasSuccessorRecord(r) && r.readiness === "3 a 5 años").length, variant: "teal" },
      { label: "+ de 5 años", count: scope.filter((r) => hasSuccessorRecord(r) && r.readiness === "+ de 5 años").length, variant: "neutral" },
      { label: "Sin Sucesor", count: scope.filter((r) => !hasSuccessorRecord(r)).length, variant: "charcoal" },
    ];
    readinessDistEl.innerHTML = rdItems
      .map((it) => {
        const pct = ((it.count / total) * 100).toFixed(0);
        return BRECA_THEME.ui.statTile({
          variant: it.variant,
          label: it.label,
          value: it.count,
          subtext: `${pct}% del total`,
        });
      })
      .join("");
  }

  const levelSummaryEl = document.getElementById("level-summary-container");
  if (levelSummaryEl) {
    const lvList = ["N-0", "N-1", "N-2", "N-3"];
    levelSummaryEl.innerHTML = lvList
      .map((lv) => {
        const totLv = scope.filter((r) => r.nivel === lv).length;
        const critLv = scope.filter((r) => r.nivel === lv && r.cargo_valor === "Sí").length;
        return BRECA_THEME.ui.statTile({
          variant: "neutral",
          label: `Nivel ${lv}`,
          value: totLv,
          subtext: `${critLv} Cargos de Valor`,
        });
      })
      .join("");
  }

  const companyBreakdownEl = document.getElementById("company-breakdown-container");
  if (companyBreakdownEl) {
    companyBreakdownEl.innerHTML = state.companies
      .map((comp) => {
        const cnt = state.records.filter((r) => r.empresa === comp).length;
        const active = state.selectedCompany === comp;
        return `
          <button type="button" data-company-chip="${escapeHtml(comp)}" class="breca-company-chip ${active ? "breca-company-chip-active" : ""}">
            <span>${escapeHtml(comp)}</span>
            <span class="opacity-70 font-bold tabular-nums">(${cnt})</span>
          </button>
        `;
      })
      .join("");
  }

  // 3. Radar de Atención Prioritaria (Riesgo Alto + Sin Sucesor)
  const alertsEl = document.getElementById("critical-alerts-list");
  if (alertsEl) {
    const criticalAlerts = scope.filter((r) => r.riesgo === "Alto" && !hasSuccessorRecord(r));
    if (criticalAlerts.length === 0) {
      alertsEl.innerHTML = `<div class="p-5 rounded-lg bg-breca-subtle text-breca-sage border border-breca-border text-xs font-semibold">No existen talentos con Riesgo Alto y sin sucesor en esta unidad.</div>`;
    } else {
      alertsEl.innerHTML = criticalAlerts
        .map(
          (r) => `
          <div class="breca-alert-card">
            <div class="min-w-0">
              <div class="text-sm font-bold text-breca-charcoal truncate">${escapeHtml(r.nombre)}</div>
              <div class="text-xs text-breca-slate mt-0.5 truncate">${escapeHtml(r.posicion)} · <span class="font-bold text-breca-petrol">${escapeHtml(r.empresa)}</span></div>
              <div class="flex flex-wrap items-center gap-1.5 mt-2">
                <span class="breca-pill breca-pill-sm breca-pill-outline">GGS ${r.ggs}</span>
                <span class="breca-pill breca-pill-sm breca-pill-outline">9-Box ${r.nine_box}</span>
                ${r.cargo_valor === "Sí" ? `<span class="breca-pill breca-pill-sm breca-pill-valor">Cargo de Valor</span>` : ""}
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                data-action="ficha"
                data-id="${r.id}"
                class="breca-btn breca-btn-ficha"
                title="Ver Ficha de Valoración Ejecutiva Ecualizada"
              >
                Ficha
              </button>
              <button
                type="button"
                data-action="edit-critical"
                data-id="${r.id}"
                class="breca-btn breca-btn-secondary !px-2.5 !py-1"
                title="Asignar sucesor o actualizar registro"
              >
                Gestionar
              </button>
            </div>
          </div>
        `
        )
        .join("");
    }
  }
}

function updateLiveCharts(scope) {
  if (!window.Chart) return;
  const palette = BRECA_THEME.getPalette();

  // --------------------------------------------------------------------------
  // GRÁFICO 1: Riesgo de Pérdida vs. Cobertura de Sucesión (Barras Apiladas)
  // Tokens de BRECA_THEME: petrol (Con Sucesor) y gray (Sin Sucesor)
  // --------------------------------------------------------------------------
  const riskLabels = ["Alto", "Medio", "Bajo"];
  const riskWithSucc = riskLabels.map((rk) => scope.filter((r) => r.riesgo === rk && hasSuccessorRecord(r)).length);
  const riskNoSucc = riskLabels.map((rk) => scope.filter((r) => r.riesgo === rk && !hasSuccessorRecord(r)).length);

  const ctxRisk = document.getElementById("chart-risk-coverage");
  if (ctxRisk) {
    if (chartInstances.riskCoverage) {
      chartInstances.riskCoverage.data.datasets[0].data = riskWithSucc;
      chartInstances.riskCoverage.data.datasets[1].data = riskNoSucc;
      chartInstances.riskCoverage.update();
    } else {
      chartInstances.riskCoverage = new window.Chart(ctxRisk, {
        type: "bar",
        data: {
          labels: ["Riesgo Alto", "Riesgo Medio", "Riesgo Bajo"],
          datasets: [
            {
              label: "Con Sucesor",
              data: riskWithSucc,
              backgroundColor: palette.petrol,
              borderRadius: 4,
              barPercentage: 0.56,
            },
            {
              label: "Sin Sucesor (Brecha)",
              data: riskNoSucc,
              backgroundColor: palette.gray,
              borderRadius: 4,
              barPercentage: 0.56,
            },
          ],
        },
        options: BRECA_THEME.createChartOptions({
          stacked: true,
          onClick: (_evt, elements) => {
            if (!elements.length) return;
            const idx = elements[0].index;
            const chosenRisk = riskLabels[idx];
            state.filterRisk = chosenRisk;
            const riskSel = document.getElementById("filter-risk");
            if (riskSel) riskSel.value = chosenRisk;
            switchTab("table");
            applyFiltersAndRender();
          },
        }),
      });
    }
  }

  // --------------------------------------------------------------------------
  // GRÁFICO 2: Pipeline por Horizonte de Readiness (Doughnut Ejecutivo)
  // Tokens de BRECA_THEME: sage, petrol, teal, slate, gray
  // --------------------------------------------------------------------------
  const readinessCounts = [
    scope.filter((r) => hasSuccessorRecord(r) && r.readiness === "Inmediato").length,
    scope.filter((r) => hasSuccessorRecord(r) && r.readiness === "1 a 3 años").length,
    scope.filter((r) => hasSuccessorRecord(r) && r.readiness === "3 a 5 años").length,
    scope.filter((r) => hasSuccessorRecord(r) && r.readiness === "+ de 5 años").length,
    scope.filter((r) => !hasSuccessorRecord(r)).length,
  ];

  const ctxReadiness = document.getElementById("chart-readiness-pipeline");
  if (ctxReadiness) {
    if (chartInstances.readinessPipeline) {
      chartInstances.readinessPipeline.data.datasets[0].data = readinessCounts;
      chartInstances.readinessPipeline.update();
    } else {
      chartInstances.readinessPipeline = new window.Chart(ctxReadiness, {
        type: "doughnut",
        data: {
          labels: ["Inmediato (Ready Now)", "1 a 3 años", "3 a 5 años", "+ de 5 años", "Sin Sucesor"],
          datasets: [
            {
              data: readinessCounts,
              backgroundColor: [palette.sage, palette.petrol, palette.teal, palette.slate, palette.gray],
              borderWidth: 2,
              borderColor: palette.surface,
              hoverOffset: 5,
            },
          ],
        },
        options: BRECA_THEME.createChartOptions({
          isDoughnut: true,
          cutout: "64%",
          legendPadding: 10,
        }),
      });
    }
  }

  // --------------------------------------------------------------------------
  // GRÁFICO 3: Nivel de Posición (N-0, N-1, N-2, N-3) y Cargos de Valor
  // Tokens de BRECA_THEME: charcoal (Cargo de Valor) y teal (Posición Estándar)
  // --------------------------------------------------------------------------
  const levels = ["N-0", "N-1", "N-2", "N-3"];
  const criticalByLevel = levels.map((lv) => scope.filter((r) => r.nivel === lv && r.cargo_valor === "Sí").length);
  const standardByLevel = levels.map((lv) => scope.filter((r) => r.nivel === lv && r.cargo_valor !== "Sí").length);

  const ctxLevel = document.getElementById("chart-level-critical");
  if (ctxLevel) {
    if (chartInstances.levelCritical) {
      chartInstances.levelCritical.data.datasets[0].data = criticalByLevel;
      chartInstances.levelCritical.data.datasets[1].data = standardByLevel;
      chartInstances.levelCritical.update();
    } else {
      chartInstances.levelCritical = new window.Chart(ctxLevel, {
        type: "bar",
        data: {
          labels: ["Nivel N-0 (CEO/GG)", "Nivel N-1 (Directivo)", "Nivel N-2 (Gerencial)", "Nivel N-3 (Subgerente)"],
          datasets: [
            {
              label: "Cargo de Valor (Crítico)",
              data: criticalByLevel,
              backgroundColor: palette.charcoal,
              borderRadius: 4,
              barPercentage: 0.58,
            },
            {
              label: "Posición Estándar",
              data: standardByLevel,
              backgroundColor: palette.teal,
              borderRadius: 4,
              barPercentage: 0.58,
            },
          ],
        },
        options: BRECA_THEME.createChartOptions({ stacked: false }),
      });
    }
  }

  // --------------------------------------------------------------------------
  // GRÁFICO 4: Cobertura y Riesgo por Unidad de Negocio (12 Empresas Breca)
  // Tokens de BRECA_THEME: petrol (Con Sucesor), gray (Sin Sucesor), charcoal (Riesgo Alto)
  // --------------------------------------------------------------------------
  const companyStats = state.companies
    .map((c) => {
      const rows = state.records.filter((r) => r.empresa === c);
      return {
        company: c,
        total: rows.length,
        withSucc: rows.filter((r) => hasSuccessorRecord(r)).length,
        noSucc: rows.filter((r) => !hasSuccessorRecord(r)).length,
        highRisk: rows.filter((r) => r.riesgo === "Alto").length,
      };
    })
    .sort((a, b) => b.total - a.total);

  const compLabels = companyStats.map((s) => s.company);
  const compWithSucc = companyStats.map((s) => s.withSucc);
  const compNoSucc = companyStats.map((s) => s.noSucc);
  const compHighRisk = companyStats.map((s) => s.highRisk);

  const ctxComp = document.getElementById("chart-company-health");
  if (ctxComp) {
    if (chartInstances.companyHealth) {
      chartInstances.companyHealth.data.labels = compLabels;
      chartInstances.companyHealth.data.datasets[0].data = compWithSucc;
      chartInstances.companyHealth.data.datasets[1].data = compNoSucc;
      chartInstances.companyHealth.data.datasets[2].data = compHighRisk;
      chartInstances.companyHealth.update();
    } else {
      chartInstances.companyHealth = new window.Chart(ctxComp, {
        type: "bar",
        data: {
          labels: compLabels,
          datasets: [
            {
              label: "Con Sucesor",
              data: compWithSucc,
              backgroundColor: palette.petrol,
              borderRadius: 4,
            },
            {
              label: "Sin Sucesor",
              data: compNoSucc,
              backgroundColor: palette.gray,
              borderRadius: 4,
            },
            {
              label: "Riesgo Alto",
              data: compHighRisk,
              backgroundColor: palette.charcoal,
              borderRadius: 4,
            },
          ],
        },
        options: BRECA_THEME.createChartOptions({
          stacked: false,
          legendPadding: 16,
          onClick: (_evt, elements) => {
            if (!elements.length) return;
            const idx = elements[0].index;
            const chosenComp = compLabels[idx];
            if (chosenComp) {
              state.selectedCompany = chosenComp;
              const sel = document.getElementById("global-company-select");
              if (sel) sel.value = chosenComp;
              applyFiltersAndRender();
            }
          },
        }),
      });
    }
  }
}

// ============================================================================
// RENDERIZADO DE LA TABLA EJECUTIVA (VISTA 2: DIRECTORIO Y DATOS EXCEL)
// ============================================================================
function renderTable() {
  const tbody = document.getElementById("talent-table-body");
  const emptyState = document.getElementById("table-empty-state");
  const paginationInfo = document.getElementById("pagination-info");
  const pageIndicator = document.getElementById("page-indicator");
  const btnPrev = document.getElementById("btn-prev-page");
  const btnNext = document.getElementById("btn-next-page");

  if (!tbody) return;

  const total = state.filteredRecords.length;
  if (total === 0) {
    tbody.innerHTML = "";
    if (emptyState) emptyState.classList.remove("hidden");
    if (paginationInfo) paginationInfo.textContent = "0 de 0";
    if (pageIndicator) pageIndicator.textContent = "0 / 0";
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  const startIdx = (state.currentPage - 1) * state.pageSize;
  const endIdx = Math.min(startIdx + state.pageSize, total);
  const pageItems = state.filteredRecords.slice(startIdx, endIdx);

  if (paginationInfo) paginationInfo.textContent = `${startIdx + 1}–${endIdx} de ${total}`;
  if (pageIndicator) pageIndicator.textContent = `${state.currentPage} / ${totalPages}`;
  if (btnPrev) btnPrev.disabled = state.currentPage <= 1;
  if (btnNext) btnNext.disabled = state.currentPage >= totalPages;

  tbody.innerHTML = pageItems
    .map((r) => {
      const boxMeta = NINE_BOX_META[r.nine_box] || NINE_BOX_META[5];
      const riskBadge = BRECA_THEME.ui.riskBadge(r.riesgo);
      const readinessBadge = BRECA_THEME.ui.readinessBadge(r.readiness, hasSuccessorRecord(r));
      const criticalPill =
        r.cargo_valor === "Sí"
          ? `<span class="breca-pill breca-pill-sm breca-pill-valor" title="Posición Crítica / Cargo de Valor">Cargo de Valor</span>`
          : "";

      return `
        <tr class="group">
          <td class="py-3.5 px-5">
            <div class="flex items-center gap-3.5">
              <div class="breca-avatar-circle">
                ${escapeHtml(getInitials(r.nombre))}
              </div>
              <div class="min-w-0">
                <button type="button" data-action="ficha" data-id="${r.id}" class="breca-person-link" title="Ver Ficha de Valoración Ejecutiva Ecualizada de ${escapeHtml(r.nombre)}">
                  ${escapeHtml(r.nombre)}
                </button>
                <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span class="breca-pill breca-pill-sm breca-pill-outline">
                    ${escapeHtml(r.empresa)}
                  </span>
                  <span class="text-[10px] font-semibold text-breca-slate">DNI: ${escapeHtml(r.documento)}</span>
                  <span class="text-[11px] text-breca-slate truncate">· ${escapeHtml(r.tiempo_posicion)}</span>
                </div>
              </div>
            </div>
          </td>

          <td class="py-3.5 px-4">
            <div class="font-medium text-breca-charcoal leading-snug">${escapeHtml(r.posicion)}</div>
            <div class="flex items-center gap-1.5 mt-1">
              <span class="breca-pill breca-pill-sm breca-pill-neutral">
                ${escapeHtml(r.nivel)}
              </span>
              ${criticalPill}
            </div>
          </td>

          <td class="py-3.5 px-3 text-center">
            <span class="breca-pill breca-pill-outline font-bold">
              GGS ${r.ggs}
            </span>
          </td>

          <td class="py-3.5 px-3 text-center">
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border ${boxMeta.badgeClass}">
              <span>${r.nine_box}</span>
              <span class="hidden xl:inline font-medium opacity-85">· ${boxMeta.short}</span>
            </span>
          </td>

          <td class="py-3.5 px-3 text-center">
            ${riskBadge}
          </td>

          <td class="py-3.5 px-4">
            ${
              hasSuccessorRecord(r)
                ? `<div class="flex flex-col gap-1">
                     <span class="font-semibold text-breca-charcoal leading-tight">${escapeHtml(r.sucesor)}</span>
                     <div class="flex flex-wrap items-center gap-1.5">
                       ${readinessBadge}
                       ${
                         r.motivacion_sucesor && r.motivacion_sucesor !== "-"
                           ? `<span class="text-[10px] font-semibold text-breca-slate">Motivación: ${escapeHtml(r.motivacion_sucesor)}</span>`
                           : ""
                       }
                     </div>
                   </div>`
                : `<div>${readinessBadge}</div>`
            }
          </td>

          <td class="py-3.5 px-5 text-right whitespace-nowrap">
            <div class="inline-flex items-center gap-1.5">
              <button
                type="button"
                data-action="ficha"
                data-id="${r.id}"
                class="breca-btn breca-btn-ficha"
                title="Generar Ficha de Valoración Ejecutiva Ecualizada"
              >
                Ficha
              </button>
              <button
                type="button"
                data-action="edit"
                data-id="${r.id}"
                class="breca-btn-icon"
                title="Editar registro"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                type="button"
                data-action="delete"
                data-id="${r.id}"
                class="breca-btn-icon"
                title="Eliminar registro"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

// ============================================================================
// AGENTE CONVERSACIONAL IA — ENRUTADOR HÍBRIDO, MODOS Y VALIDADOR HTML
// ============================================================================
function setQuickActionsMode(mode, keepCollapsedState = false) {
  const targetMode = mode === "open" ? "open" : "templates";
  const isSameModeAndOpen = state.quickActionsMode === targetMode && !state.quickActionsCollapsed;
  state.quickActionsMode = targetMode;

  const btnTemplates = document.getElementById("btn-mode-templates");
  const btnOpen = document.getElementById("btn-mode-open");
  const desc = document.getElementById("quick-actions-mode-desc");

  if (btnTemplates && btnOpen) {
    btnTemplates.classList.remove("chat-mode-tab-active", "chat-mode-tab-open");
    btnOpen.classList.remove("chat-mode-tab-active", "chat-mode-tab-open");
    if (state.quickActionsMode === "open") {
      btnOpen.classList.add("chat-mode-tab-open");
    } else {
      btnTemplates.classList.add("chat-mode-tab-active");
    }
  }

  if (desc) {
    desc.innerHTML =
      state.quickActionsMode === "open"
        ? "🧠 <strong>Sugerencias de Análisis IA:</strong> Estrategia, retención y movilidad"
        : "⚡ <strong>Plantillas Ejecutivas:</strong> Selecciona una consulta rápida";
  }

  renderQuickActions();
  if (!keepCollapsedState) {
    toggleQuickActions(isSameModeAndOpen ? true : false);
  }
}

function renderQuickActions() {
  const drawerGrid = document.getElementById("quick-actions-grid");
  if (!drawerGrid) return;

  const isOpenMode = state.quickActionsMode === "open";
  const items = isOpenMode ? OPEN_ANALYSIS_ACTIONS : QUICK_ACTIONS;

  drawerGrid.innerHTML = items
    .map(
      (qa) => `
      <button
        type="button"
        data-quick-question="${escapeHtml(qa.question)}"
        class="ai-prompt-card ${isOpenMode ? "ai-prompt-card-open" : ""} text-left px-3 py-2.5 flex flex-col justify-between gap-1 group"
      >
        <div class="flex items-center justify-between gap-1.5">
          <span class="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
            isOpenMode ? "ai-prompt-cat-open" : "ai-prompt-cat-template"
          }">
            <span>${qa.icon}</span>
            <span>${escapeHtml(qa.category)}</span>
          </span>
          <span class="text-xs text-breca-gray group-hover:text-breca-petrol transition-colors font-bold">→</span>
        </div>
        <div class="text-[11.5px] font-bold text-breca-charcoal group-hover:text-breca-petrol leading-snug line-clamp-2">
          ${escapeHtml(qa.question)}
        </div>
      </button>
    `
    )
    .join("");
}

function renderQuestionCatalog() {
  const container = document.getElementById("catalog-questions-container");
  if (!container) return;
  container.innerHTML = QUESTION_CATALOG.map(
    (cat, idx) => `
      <div class="bg-white p-3 rounded-lg border ${idx === 5 ? "ai-prompt-card-open" : "border-breca-border"}">
        <div class="font-extrabold ${idx === 5 ? "text-breca-teal" : "text-breca-charcoal"} text-xs mb-2">${escapeHtml(cat.category)}</div>
        <div class="grid grid-cols-1 gap-1.5">
          ${cat.items
            .map(
              (q) => `
              <button
                type="button"
                data-catalog-question="${escapeHtml(q)}"
                class="w-full text-left px-3 py-2 rounded-md bg-breca-subtle hover:bg-breca-petrol text-breca-charcoal hover:text-white border border-breca-border hover:border-breca-petrol transition-colors text-xs font-medium"
              >
                ${escapeHtml(q)}
              </button>
            `
            )
            .join("")}
        </div>
      </div>
    `
  ).join("");
}

/**
 * Cambia la pestaña visible en dispositivos móviles (< lg) dentro de la ventana flotante dividida:
 * - "chat": Muestra el chat conversacional y oculta el lienzo izquierdo en móvil.
 * - "canvas": Muestra el lienzo de gráficos/tablas y oculta el chat en móvil.
 * En escritorio (lg:flex), ambos paneles permanecen visibles simultáneamente lado a lado.
 */
function switchMobileWorkspaceTab(tabName) {
  state.mobileWorkspaceTab = tabName === "canvas" ? "canvas" : "chat";
  const canvasPanel = document.getElementById("ai-canvas-panel");
  const chatPanel = document.getElementById("ai-chat-panel");
  const btnChat = document.getElementById("btn-mobile-view-chat");
  const btnCanvas = document.getElementById("btn-mobile-view-canvas");

  if (!canvasPanel || !chatPanel) return;

  if (state.mobileWorkspaceTab === "canvas") {
    canvasPanel.classList.remove("hidden");
    canvasPanel.classList.add("flex");
    chatPanel.classList.add("hidden", "lg:flex");
    chatPanel.classList.remove("flex");

    btnCanvas?.classList.add("breca-mobile-tab-active");
    btnChat?.classList.remove("breca-mobile-tab-active");
  } else {
    canvasPanel.classList.add("hidden", "lg:flex");
    canvasPanel.classList.remove("flex");
    chatPanel.classList.remove("hidden");
    chatPanel.classList.add("flex");

    btnChat?.classList.add("breca-mobile-tab-active");
    btnCanvas?.classList.remove("breca-mobile-tab-active");
  }
}

/**
 * Construye gráficos visuales SVG ejecutivos (Donut de Cobertura/Riesgo + Barras Horizontales de Readiness y 9-Box)
 * consumiendo la paleta corporativa centralizada desde BRECA_THEME.getPalette()
 * sin utilizar ningún atributo inline style= para cumplir con las reglas estrictas del proyecto.
 */
function buildQueryVisualChartHtml(query, routeType, records) {
  const palette = BRECA_THEME.getPalette();
  const allRecords = Array.isArray(records) && records.length > 0 ? records : state.records;
  const qNorm = String(query || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  // Detectar si la consulta se enfoca en una empresa específica
  const companies = [...new Set(allRecords.map((r) => r.empresa).filter(Boolean))];
  const matchedCompany = companies.find((c) =>
    qNorm.includes(c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
  );

  const scopeRecords = matchedCompany
    ? allRecords.filter((r) => r.empresa === matchedCompany)
    : allRecords;

  const scopeTitle = matchedCompany ? `Foco: ${matchedCompany}` : "Consolidado Grupo Breca";
  const total = Math.max(scopeRecords.length, 1);

  const withSuc = scopeRecords.filter((r) => r.tiene_sucesor === "Sí").length;
  const withoutSuc = scopeRecords.length - withSuc;
  const covPct = Math.round((withSuc / total) * 100);

  const riskHigh = scopeRecords.filter((r) => r.riesgo === "Alto").length;
  const riskMed = scopeRecords.filter((r) => r.riesgo === "Medio").length;
  const riskLow = scopeRecords.filter((r) => r.riesgo === "Bajo").length;
  const redAlerts = scopeRecords.filter((r) => r.riesgo === "Alto" && r.tiene_sucesor !== "Sí").length;

  const readyNow = scopeRecords.filter((r) => r.readiness === "Inmediato").length;
  const ready1to3 = scopeRecords.filter((r) => r.readiness === "1 a 3 años" || r.readiness === "1 a 2 años").length;
  const ready3to5 = scopeRecords.filter((r) => r.readiness === "3 a 5 años" || r.readiness === "+ de 5 años").length;
  const topTalent = scopeRecords.filter((r) => Number(r.nine_box) >= 8).length;

  // Cálculo de barra SVG en base a viewBox 0..200
  const barW = (count) => Math.max(6, Math.round((count / total) * 200));

  return `
    <div class="ai-canvas-visual-grid">
      <!-- Tarjeta Gráfica 1: Donut SVG de Cobertura y Semáforo de Riesgo (Paleta Breca Modular) -->
      <div class="ai-canvas-chart-card">
        <div class="flex items-center justify-between gap-2 mb-2.5">
          <span class="text-[11px] font-extrabold uppercase tracking-wider text-breca-charcoal">Cobertura y Riesgo (${escapeHtml(scopeTitle)})</span>
          <span class="ai-badge ai-badge-blue">${scopeRecords.length} pos.</span>
        </div>
        <div class="flex items-center gap-4">
          <div class="relative w-24 h-24 shrink-0 flex items-center justify-center">
            <svg class="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="${palette.divider}" stroke-width="3.8"></circle>
              <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="${palette.petrol}" stroke-width="3.6" stroke-dasharray="${covPct} ${100 - covPct}" stroke-dashoffset="0"></circle>
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span class="text-sm font-extrabold text-breca-charcoal">${covPct}%</span>
              <span class="text-[9px] font-bold uppercase text-breca-slate">Cubierto</span>
            </div>
          </div>
          <div class="flex-1 space-y-1.5 text-xs min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span class="text-breca-slate font-medium inline-flex items-center gap-1.5"><span class="breca-status-dot breca-dot-sage"></span>Con Sucesor:</span>
              <strong class="text-breca-sage font-extrabold">${withSuc} (${covPct}%)</strong>
            </div>
            <div class="flex items-center justify-between gap-2">
              <span class="text-breca-slate font-medium inline-flex items-center gap-1.5"><span class="breca-status-dot breca-dot-teal"></span>Sin Sucesor:</span>
              <strong class="text-breca-teal font-extrabold">${withoutSuc} (${100 - covPct}%)</strong>
            </div>
            <div class="flex items-center justify-between gap-2 pt-1 border-t border-breca-divider">
              <span class="text-breca-slate font-medium inline-flex items-center gap-1.5"><span class="breca-status-dot breca-dot-charcoal"></span>Riesgo Alto s/suc:</span>
              <strong class="text-breca-charcoal font-extrabold">${redAlerts}</strong>
            </div>
            <div class="flex items-center flex-wrap gap-1.5 pt-0.5 text-[10px]">
              <span class="ai-badge ai-badge-red">Alto: ${riskHigh}</span>
              <span class="ai-badge ai-badge-amber">Medio: ${riskMed}</span>
              <span class="ai-badge ai-badge-green">Bajo: ${riskLow}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tarjeta Gráfica 2: Barras SVG de Pipeline Readiness y Top Talent 9-Box (Paleta Breca Modular) -->
      <div class="ai-canvas-chart-card">
        <div class="flex items-center justify-between gap-2 mb-2.5">
          <span class="text-[11px] font-extrabold uppercase tracking-wider text-breca-charcoal">Pipeline de Sucesión y 9-Box</span>
          <span class="ai-badge ai-badge-indigo">Top 8-9: ${topTalent}</span>
        </div>
        <div class="space-y-2 text-xs">
          <div>
            <div class="flex justify-between text-[11px] mb-0.5">
              <span class="font-semibold text-breca-charcoal inline-flex items-center gap-1.5"><span class="breca-status-dot breca-dot-sage"></span>Lista Ahora (Inmediato)</span>
              <span class="font-extrabold text-breca-sage">${readyNow} pos.</span>
            </div>
            <svg class="w-full h-2.5 rounded-full overflow-hidden bg-breca-muted" viewBox="0 0 200 10" preserveAspectRatio="none">
              <rect x="0" y="0" width="${barW(readyNow)}" height="10" rx="5" fill="${palette.sage}"></rect>
            </svg>
          </div>
          <div>
            <div class="flex justify-between text-[11px] mb-0.5">
              <span class="font-semibold text-breca-charcoal inline-flex items-center gap-1.5"><span class="breca-status-dot breca-dot-petrol"></span>Corto Plazo (1 a 3 años)</span>
              <span class="font-extrabold text-breca-petrol">${ready1to3} pos.</span>
            </div>
            <svg class="w-full h-2.5 rounded-full overflow-hidden bg-breca-muted" viewBox="0 0 200 10" preserveAspectRatio="none">
              <rect x="0" y="0" width="${barW(ready1to3)}" height="10" rx="5" fill="${palette.petrol}"></rect>
            </svg>
          </div>
          <div>
            <div class="flex justify-between text-[11px] mb-0.5">
              <span class="font-semibold text-breca-charcoal inline-flex items-center gap-1.5"><span class="breca-status-dot breca-dot-teal"></span>Mediano/Largo (3 a 5+ años)</span>
              <span class="font-extrabold text-breca-teal">${ready3to5} pos.</span>
            </div>
            <svg class="w-full h-2.5 rounded-full overflow-hidden bg-breca-muted" viewBox="0 0 200 10" preserveAspectRatio="none">
              <rect x="0" y="0" width="${barW(ready3to5)}" height="10" rx="5" fill="${palette.teal}"></rect>
            </svg>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renderiza el Panorama Base (estado inicial en vivo) en el Lienzo Izquierdo (#ai-canvas-body)
 * con KPIs consolidados, gráficos SVG interactivos y tabla ejecutiva de las 12 empresas.
 */
function renderCanvasHomeOverview() {
  state.activeArtifactId = "HOME";
  const canvasBody = document.getElementById("ai-canvas-body");
  const titleEl = document.getElementById("ai-canvas-title");
  const badgeEl = document.getElementById("ai-canvas-route-badge");
  const closeBtn = document.getElementById("btn-close-active-artifact");

  if (!canvasBody) return;

  const records = state.records || [];
  const total = records.length || 101;
  const companiesCount = new Set(records.map((r) => r.empresa).filter(Boolean)).size || 12;

  if (titleEl) {
    titleEl.textContent = `Resumen Ejecutivo (${total} posiciones · ${companiesCount} empresas)`;
  }
  if (badgeEl) {
    badgeEl.className = "ai-route-badge-template shrink-0";
    badgeEl.innerHTML = "<span>📊</span><span>Resumen</span>";
  }
  if (closeBtn) {
    closeBtn.classList.add("hidden");
    closeBtn.classList.remove("inline-flex");
  }

  const chartsHtml = buildQueryVisualChartHtml("", "TEMPLATE", records);

  canvasBody.innerHTML = `
    <div class="space-y-4">
      ${chartsHtml}
      <div class="px-4 py-3 rounded-lg bg-white border border-breca-border flex items-center justify-between gap-3 text-xs text-breca-slate">
        <span>Escribe una consulta en el chat o selecciona un ejecutivo para abrir su Ficha de Valoración Ejecutiva Ecualizada o análisis con gráficos.</span>
        <span class="text-[11px] font-bold text-breca-charcoal shrink-0">${total} registros</span>
      </div>
    </div>
  `;

  updateCanvasHistoryBar();
}

function splitAgentResponseForWorkspace(validatedHtml, query, routeType, routeLabel, isLiveGemini, records, artifactId) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(validatedHtml, "text/html");

  // Extraer título del reporte o de la Ficha Ejecutiva Breca si existe
  const reportTitleEl = doc.querySelector(".breca-ficha-main-title, .ai-html-title, h3, h4");
  const reportTitle = reportTitleEl ? reportTitleEl.textContent.trim().replace(/\s+/g, " ") : query;

  const isIndividualFicha = validatedHtml.includes("breca-ficha-slide");

  // Contar tablas y KPIs presentes en la respuesta estructurada
  const tablesCount = doc.querySelectorAll("table").length;
  const kpiBoxes = Array.from(doc.querySelectorAll(".ai-kpi-box"));
  const kpiSummaryItems = kpiBoxes.slice(0, 4).map((box) => {
    const lbl = box.querySelector(".ai-kpi-label")?.textContent?.trim() || "";
    const val = box.querySelector(".ai-kpi-value")?.textContent?.trim() || "";
    return lbl && val ? `<strong>${escapeHtml(lbl)}:</strong> ${escapeHtml(val)}` : "";
  }).filter(Boolean);

  // Clonar el documento para construir la versión puramente conversacional/textual del chat
  const chatDoc = parser.parseFromString(validatedHtml, "text/html");
  // Eliminar tablas, grillas de KPI y el slide de Ficha de 4 columnas del lado del chat para que vayan exclusivamente al lienzo izquierdo
  chatDoc.querySelectorAll(".ai-table-wrap, table, .ai-kpi-grid, .ai-html-header, .breca-ficha-slide").forEach((el) => el.remove());

  // Recolectar bloques narrativos (párrafos, alertas ejecutivas y listas de hallazgos)
  const narrativeBlocks = [];
  chatDoc.querySelectorAll("p, .ai-alert-box, ul, ol").forEach((el) => {
    const text = (el.textContent || "").trim();
    if (text.length > 12 && !narrativeBlocks.some((b) => b.includes(text.slice(0, 40)))) {
      if (el.tagName === "UL" || el.tagName === "OL") {
        const items = Array.from(el.querySelectorAll("li"))
          .slice(0, 4)
          .map((li) => `<li>${li.innerHTML}</li>`)
          .join("");
        if (items) narrativeBlocks.push(`<ul>${items}</ul>`);
      } else {
        narrativeBlocks.push(`<p>${el.innerHTML}</p>`);
      }
    }
  });

  // Si era una plantilla predominantemente tabular, sintetizar un análisis textual ejecutivo para el chat
  if (narrativeBlocks.length === 0) {
    narrativeBlocks.push(
      `<p>He procesado la consulta <strong>"${escapeHtml(query)}"</strong> sobre el Talent Pool oficial (${state.records.length} posiciones) y he proyectado el reporte elaborado con sus gráficos y tablas en el panel izquierdo.</p>`
    );
  }
  if (!isIndividualFicha && kpiSummaryItems.length > 0) {
    narrativeBlocks.push(
      `<p>📌 <strong>Indicadores clave detectados:</strong> ${kpiSummaryItems.join(" · ")}.</p>`
    );
  }
  if (!isIndividualFicha && tablesCount > 0) {
    const totalRows = doc.querySelectorAll("tbody tr").length;
    narrativeBlocks.push(
      `<p>📊 Se ${tablesCount === 1 ? "ha generado <strong>1 tabla ejecutiva</strong>" : `han generado <strong>${tablesCount} tablas ejecutivas</strong>`} (${totalRows} registros detallados) en una nueva pestaña del panel izquierdo.</p>`
    );
  }

  const narrativeHtml = narrativeBlocks.slice(0, 5).join("");

  const chatConversationalHtml = `
    <div class="ai-chat-exec-card">
      <div class="ai-chat-exec-header">
        <span class="ai-chat-status-pill ai-chat-status-ready">
          <span class="breca-status-dot breca-dot-sage"></span>
          <span>${isIndividualFicha ? "Ficha Ejecutiva Ecualizada" : "Análisis completado"}</span>
        </span>
        <span class="text-[10px] font-bold text-breca-slate truncate max-w-full">${escapeHtml(routeLabel)}</span>
      </div>
      <div class="ai-chat-narrative">
        ${narrativeHtml}
      </div>
      <button type="button" data-focus-artifact="${escapeHtml(artifactId)}" class="ai-chat-canvas-btn">
        <span class="min-w-0 flex-1">Ver en el lienzo izquierdo: <strong>${escapeHtml(reportTitle.slice(0, 48))}</strong></span>
        <span class="shrink-0">→</span>
      </button>
    </div>
  `;

  // Construir el contenido visual elaborado para el Lienzo Izquierdo (#ai-canvas-body):
  // Las tarjetas de Resumen (Cobertura/Riesgo y Pipeline 9-Box) son exclusivas de la vista inicial
  // "Resumen" (renderCanvasHomeOverview) y NO se repiten en las nuevas subpestañas generadas (#1, #2, etc.).
  const canvasVisualHtml = `
    <div class="ai-canvas-artifact-content animate-fade-in">
      ${validatedHtml}
    </div>
  `;

  return {
    reportTitle,
    chatConversationalHtml,
    canvasVisualHtml,
  };
}

/**
 * Actualiza la barra superior de historial de reportes en el Lienzo Izquierdo.
 */
function updateCanvasHistoryBar() {
  const bar = document.getElementById("ai-canvas-history-bar");
  const list = document.getElementById("ai-canvas-history-list");
  const mobileBadge = document.getElementById("mobile-canvas-badge");

  if (!bar || !list) return;

  const artifacts = state.canvasArtifacts || [];
  if (mobileBadge) {
    mobileBadge.textContent = artifacts.length > 0 ? `${artifacts.length} rep.` : "Vivo";
  }

  bar.classList.remove("hidden");
  const isHomeActive = !state.activeArtifactId || state.activeArtifactId === "HOME";
  const homeTabHtml = `
    <div class="ai-history-chip-group ${isHomeActive ? "ai-history-chip-active" : ""}">
      <button
        type="button"
        data-artifact-id="HOME"
        class="ai-history-chip-btn"
        title="Primera pestaña: Resumen con los 2 gráficos generales"
      >
        <span>📊</span>
        <span>Resumen</span>
      </button>
    </div>
  `;

  const generatedTabsHtml = artifacts
    .map((art, idx) => {
      const isActive = state.activeArtifactId === art.id;
      const shortLabel =
        art.title.length > 26 ? art.title.slice(0, 24) + "…" : art.title;
      return `
        <div class="ai-history-chip-group ${isActive ? "ai-history-chip-active" : ""}">
          <button
            type="button"
            data-artifact-id="${escapeHtml(art.id)}"
            class="ai-history-chip-btn"
            title="${escapeHtml(art.query || art.title)}"
          >
            <span>#${idx + 1}</span>
            <span>${escapeHtml(shortLabel)}</span>
          </button>
          <button
            type="button"
            data-delete-artifact="${escapeHtml(art.id)}"
            class="ai-history-chip-close"
            title="Cerrar ventana"
            aria-label="Cerrar ventana ${escapeHtml(shortLabel)}"
          >
            ✕
          </button>
        </div>
      `;
    })
    .join("");

  list.innerHTML = homeTabHtml + generatedTabsHtml;
}

/**
 * Elimina/cierra una ventana de resultado generada en el Lienzo Izquierdo.
 * Si era la ventana activa, pasa a la anterior disponible o regresa a los 2 gráficos base ("HOME").
 */
function deleteCanvasArtifact(artifactId) {
  if (!Array.isArray(state.canvasArtifacts)) return;
  const idx = state.canvasArtifacts.findIndex((a) => a.id === artifactId);
  if (idx === -1) return;

  state.canvasArtifacts.splice(idx, 1);

  if (state.activeArtifactId === artifactId) {
    if (state.canvasArtifacts.length > 0) {
      const nextArt = state.canvasArtifacts[Math.max(0, idx - 1)];
      renderActiveCanvasArtifact(nextArt.id);
    } else {
      renderCanvasHomeOverview();
    }
  } else {
    updateCanvasHistoryBar();
  }
}

/**
 * Muestra un reporte específico del historial en el Lienzo Izquierdo (#ai-canvas-body).
 */
function renderActiveCanvasArtifact(artifactId) {
  if (!artifactId || artifactId === "HOME") {
    renderCanvasHomeOverview();
    return;
  }

  const art = (state.canvasArtifacts || []).find((a) => a.id === artifactId);
  if (!art) {
    renderCanvasHomeOverview();
    return;
  }

  state.activeArtifactId = art.id;
  const canvasBody = document.getElementById("ai-canvas-body");
  const titleEl = document.getElementById("ai-canvas-title");
  const badgeEl = document.getElementById("ai-canvas-route-badge");
  const closeBtn = document.getElementById("btn-close-active-artifact");

  if (titleEl) titleEl.textContent = art.title || art.query;
  if (closeBtn) {
    closeBtn.classList.remove("hidden");
    closeBtn.classList.add("inline-flex");
  }
  if (badgeEl) {
    const isOpen = art.routeType === "OPEN_ANALYSIS";
    badgeEl.className = isOpen ? "ai-route-badge-open shrink-0" : "ai-route-badge-template shrink-0";
    badgeEl.innerHTML = `<span>${art.isLiveGemini ? "✨" : isOpen ? "🧠" : "⚡"}</span><span>${escapeHtml(art.routeLabel || "Reporte")}</span>`;
  }

  if (canvasBody) {
    canvasBody.innerHTML = art.canvasHtml;
    canvasBody.scrollTop = 0;
  }

  updateCanvasHistoryBar();
}

function startNewChatSession() {
  state.chatHistory = [];
  state.lastEntityPerson = null;
  state.canvasArtifacts = [];
  state.activeArtifactId = "HOME";
  const container = document.getElementById("chat-messages-container");
  if (!container) return;

  const total = state.records.length || 101;
  const companiesCount = new Set(state.records.map((r) => r.empresa)).size || 12;

  setQuickActionsMode("templates", true);
  toggleQuickActions(true);
  renderCanvasHomeOverview();

  container.innerHTML = `
    <div class="flex items-start gap-2.5 min-w-0 max-w-full">
      <div class="breca-ai-avatar mt-0.5 shrink-0">
        IA
      </div>
      <div class="chat-bubble-ai rounded-xl rounded-tl-sm px-3.5 py-3 text-xs text-breca-charcoal flex-1 min-w-0 leading-relaxed">
        <p class="font-bold text-breca-charcoal mb-1">Asistente Ejecutivo (${total} posiciones · ${companiesCount} empresas)</p>
        <p class="text-breca-slate">
          Escribe tu consulta abajo o haz clic en <button type="button" data-expand-quick="true" class="chat-inline-link-btn">Ver plantillas ▼</button> para generar fichas ejecutivas ecualizadas y reportes con gráficos.
        </p>
      </div>
    </div>
  `;
}

function toggleQuickActions(forceCollapse) {
  const section = document.getElementById("quick-actions-section");
  const btnCollapse = document.getElementById("btn-collapse-quick-actions");
  if (!section) return;

  if (typeof forceCollapse === "boolean") {
    state.quickActionsCollapsed = forceCollapse;
  } else {
    state.quickActionsCollapsed = !state.quickActionsCollapsed;
  }

  if (state.quickActionsCollapsed) {
    section.classList.add("hidden");
    if (btnCollapse) btnCollapse.textContent = "Ver plantillas ▼";
  } else {
    section.classList.remove("hidden");
    if (btnCollapse) btnCollapse.textContent = "Ocultar ▲";
  }
}

function openChatDrawer() {
  const overlay = document.getElementById("chat-drawer-overlay");
  if (!overlay) return;
  overlay.classList.remove("hidden");
  if (!state.chatHistory || state.chatHistory.length === 0) {
    startNewChatSession();
  } else if (!document.getElementById("ai-canvas-body")?.innerHTML.trim()) {
    renderActiveCanvasArtifact(state.activeArtifactId || "HOME");
  }
}

function minimizeChatDrawer() {
  const overlay = document.getElementById("chat-drawer-overlay");
  if (overlay) overlay.classList.add("hidden");
}

function closeChatDrawer() {
  const overlay = document.getElementById("chat-drawer-overlay");
  if (overlay) overlay.classList.add("hidden");
  startNewChatSession();
}

/**
 * Valida y sanea la estructura HTML devuelta por el LLM usando DOMParser:
 * - Elimina etiquetas no seguras (script, iframe, style, object, embed) y atributos style/on*.
 * - Verifica si es una respuesta lineal (<p class="ai-linear-response">) o una respuesta
 *   estructurada (<div class="ai-structured-response">).
 */
function validateAndSanitizeAgentHtml(rawResponse, isLinearHint = false) {
  let cleaned = String(rawResponse || "").trim();
  cleaned = cleaned.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "").trim();

  const hasStructuredClass =
    cleaned.includes("ai-structured-response") ||
    cleaned.includes("ai-html-card") ||
    cleaned.includes("ai-table");
  const hasLinearClass = cleaned.includes("ai-linear-response");
  const isLinear = Boolean(isLinearHint || (hasLinearClass && !hasStructuredClass));

  if (!hasStructuredClass && !hasLinearClass && !cleaned.startsWith("<")) {
    cleaned = window.marked ? window.marked.parse(cleaned) : `<p class="ai-linear-response">${escapeHtml(cleaned)}</p>`;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleaned, "text/html");

  doc.querySelectorAll("script, iframe, object, embed, style, link, meta").forEach((el) => el.remove());

  doc.body.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name === "style" || name.startsWith("on")) {
        el.removeAttribute(attr.name);
      }
    });
    if (el.tagName === "TABLE" && !el.classList.contains("ai-table")) {
      el.classList.add("ai-table");
    }
  });

  const sanitizedInner = doc.body.innerHTML.trim();

  if (isLinear) {
    if (sanitizedInner.includes("ai-linear-response")) {
      return { html: sanitizedInner, isLinear: true };
    }
    return {
      html: `<p class="ai-linear-response">${doc.body.textContent || escapeHtml(cleaned)}</p>`,
      isLinear: true,
    };
  }

  if (sanitizedInner.includes("ai-structured-response")) {
    return { html: sanitizedInner, isLinear: false };
  }

  return {
    html: `<div class="ai-structured-response"><div class="ai-html-card"><div class="ai-html-body nexia-markdown">${sanitizedInner}</div></div></div>`,
    isLinear: false,
  };
}

// ============================================================================
// GESTIÓN DE GOOGLE GEMINI API KEY & CONSULTA EN VIVO EN CLIENTE (GITHUB PAGES)
// ============================================================================
const GEMINI_STORAGE_KEY = "centria_gemini_api_key";

function getStoredGeminiKey() {
  try {
    const params = new URLSearchParams(window.location.search);
    const paramKey = params.get("key") || params.get("gemini_key") || params.get("api_key");
    if (paramKey && paramKey.trim().length > 10) {
      localStorage.setItem("centria_gemini_api_key", paramKey.trim());
      return paramKey.trim();
    }
    if (window.CENTRIA_CONFIG && window.CENTRIA_CONFIG.GEMINI_API_KEY) {
      return String(window.CENTRIA_CONFIG.GEMINI_API_KEY).trim();
    }
    if (window.GEMINI_API_KEY) {
      return String(window.GEMINI_API_KEY).trim();
    }
    return localStorage.getItem("centria_gemini_api_key") || "";
  } catch (_e) {
    return "";
  }
}

/**
 * Smart Document Digester (Digestor Inteligente de Datos de Sucesión)
 */
function digestTalentDocumentForLLM(query, records) {
  const qNorm = String(query || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const allRecords = Array.isArray(records) ? records : [];
  const total = allRecords.length || 1;

  const companies = [...new Set(allRecords.map(r => r.empresa).filter(Boolean))];
  const criticalRoles = allRecords.filter(r => r.cargo_valor === "Sí");
  const withSuccessor = allRecords.filter(r => r.tiene_sucesor === "Sí");
  const withoutSuccessor = allRecords.filter(r => r.tiene_sucesor !== "Sí");
  const criticalNoSuccessor = allRecords.filter(r => r.cargo_valor === "Sí" && r.tiene_sucesor !== "Sí");

  const highRisk = allRecords.filter(r => r.riesgo === "Alto");
  const medRisk = allRecords.filter(r => r.riesgo === "Medio");
  const lowRisk = allRecords.filter(r => r.riesgo === "Bajo");

  const imminentRedAlerts = allRecords.filter(r => r.riesgo === "Alto" && r.tiene_sucesor !== "Sí");

  const readyNow = allRecords.filter(r => r.readiness === "Inmediato");
  const ready1to2 = allRecords.filter(r => r.readiness === "1 a 2 años");
  const ready3to5 = allRecords.filter(r => r.readiness === "3 a 5 años" || r.readiness === "+ de 5 años");

  const topTalentBox9 = allRecords.filter(r => Number(r.nine_box) === 9);
  const topTalentBox8 = allRecords.filter(r => Number(r.nine_box) === 8);
  const keyPlayersBox5 = allRecords.filter(r => Number(r.nine_box) === 5);

  const motHigh = allRecords.filter(r => r.motivacion_sucesor === "Alta");
  const motMed = allRecords.filter(r => r.motivacion_sucesor === "Media");
  const motLow = allRecords.filter(r => r.motivacion_sucesor === "Baja");

  const companyDigest = companies.map(c => {
    const subset = allRecords.filter(r => r.empresa === c);
    const subWithSuc = subset.filter(r => r.tiene_sucesor === "Sí").length;
    const subCriticalNoSuc = subset.filter(r => r.cargo_valor === "Sí" && r.tiene_sucesor !== "Sí").length;
    const subHighRisk = subset.filter(r => r.riesgo === "Alto").length;
    return {
      empresa: c,
      total_posiciones: subset.length,
      cobertura_pct: `${Math.round((subWithSuc / Math.max(subset.length, 1)) * 1000) / 10}%`,
      cargos_criticos_sin_sucesor: subCriticalNoSuc,
      riesgos_altos_fuga: subHighRisk
    };
  });

  const mentionedTalents = allRecords.filter(r => {
    const nameNorm = (r.nombre || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const parts = nameNorm.split(/\s+/).filter(p => p.length >= 4);
    return parts.some(p => qNorm.includes(p));
  });

  const matchedCompany = companies.find(c => {
    const cNorm = c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return qNorm.includes(cNorm);
  });

  let focusDetails = {};

  if (mentionedTalents.length > 0) {
    focusDetails.tipo = "FOCO_TALENTO_INDIVIDUAL";
    focusDetails.talentos_en_foco = mentionedTalents.map(t => {
      const isSuccessorOf = allRecords.filter(r => r.sucesor === t.nombre).map(r => `${r.nombre} (${r.posicion} - ${r.empresa})`);
      const internalBench = allRecords.filter(r =>
        r.id !== t.id &&
        Number(r.nine_box) >= 8 &&
        r.riesgo !== "Alto" &&
        (r.nivel === t.nivel || Math.abs(Number(r.ggs) - Number(t.ggs)) <= 1)
      ).slice(0, 4).map(b => ({
        nombre: b.nombre,
        empresa: b.empresa,
        posicion: b.posicion,
        ggs: b.ggs,
        nine_box: b.nine_box,
        riesgo: b.riesgo,
        sucesor_propio: b.tiene_sucesor === "Sí" ? `${b.sucesor} (${b.readiness})` : "Sin sucesor"
      }));

      return {
        perfil: {
          nombre: t.nombre,
          empresa: t.empresa,
          posicion: t.posicion,
          nivel: t.nivel,
          ggs: t.ggs,
          nine_box: t.nine_box,
          riesgo_perdida: t.riesgo,
          cargo_de_valor: t.cargo_valor,
          tiempo_en_posicion: t.tiempo_posicion,
          tiene_sucesor: t.tiene_sucesor,
          sucesor_designado: t.sucesor || "Ninguno",
          readiness_sucesor: t.readiness || "N/A",
          motivacion_sucesor: t.motivacion_sucesor || "N/A"
        },
        impacto_efecto_domino: isSuccessorOf.length > 0 ? `Es sucesor designado de: ${isSuccessorOf.join(", ")}` : "No es sucesor de ninguna otra posición",
        banco_interno_candidatos_puente: internalBench
      };
    });
  } else if (matchedCompany) {
    focusDetails.tipo = "FOCO_EMPRESA";
    const compRecords = allRecords.filter(r => r.empresa === matchedCompany);
    focusDetails.empresa = matchedCompany;
    focusDetails.posiciones_evaluadas = compRecords.length;
    focusDetails.posiciones_sin_sucesor = compRecords.filter(r => r.tiene_sucesor !== "Sí").map(r => ({
      nombre: r.nombre,
      posicion: r.posicion,
      cargo_valor: r.cargo_valor,
      riesgo: r.riesgo,
      tiempo_posicion: r.tiempo_posicion
    }));
    focusDetails.top_talent_box8_9 = compRecords.filter(r => Number(r.nine_box) >= 8).map(r => ({
      nombre: r.nombre,
      posicion: r.posicion,
      nine_box: r.nine_box,
      riesgo: r.riesgo,
      sucesor: r.sucesor || "Sin sucesor",
      readiness: r.readiness
    }));
  } else if (qNorm.includes("aceler") || qNorm.includes("pipeline") || qNorm.includes("ready now") || qNorm.includes("inmediato")) {
    focusDetails.tipo = "FOCO_PIPELINE_ACELERACION";
    focusDetails.sucesores_1_a_2_anos_para_acelerar = ready1to2.slice(0, 12).map(r => ({
      posicion_cubierta: `${r.nombre} (${r.posicion} - ${r.empresa})`,
      sucesor_designado: r.sucesor,
      readiness_actual: r.readiness,
      motivacion: r.motivacion_sucesor,
      cargo_valor: r.cargo_valor
    }));
  } else if (qNorm.includes("retenc") || qNorm.includes("fuga") || qNorm.includes("riesgo") || qNorm.includes("vulnerab")) {
    focusDetails.tipo = "FOCO_RETENCION_Y_VULNERABILIDAD";
    focusDetails.casos_criticos_inminentes = imminentRedAlerts.map(r => ({
      nombre: r.nombre,
      empresa: r.empresa,
      posicion: r.posicion,
      nivel: r.nivel,
      tiempo_posicion: r.tiempo_posicion,
      nine_box: r.nine_box
    }));
    focusDetails.top_talents_con_riesgo_fuga = allRecords.filter(r => Number(r.nine_box) >= 8 && r.riesgo !== "Bajo").slice(0, 8).map(r => ({
      nombre: r.nombre,
      empresa: r.empresa,
      posicion: r.posicion,
      nine_box: r.nine_box,
      riesgo: r.riesgo,
      tiene_sucesor: r.tiene_sucesor
    }));
  } else {
    focusDetails.tipo = "FOCO_ESTRATEGICO_GLOBAL";
    focusDetails.alertas_rojas_inminentes = imminentRedAlerts.slice(0, 8).map(r => ({
      nombre: r.nombre,
      empresa: r.empresa,
      posicion: r.posicion,
      nivel: r.nivel,
      tiempo_posicion: r.tiempo_posicion
    }));
  }

  return {
    documento_fuente: "2026_Reporte_Sucesion.xlsx (Talent Pool Oficial Grupo Breca)",
    metricas_macro_grupo_breca: {
      total_posiciones_evaluadas: total,
      total_empresas: companies.length,
      cobertura_sucesion: {
        con_sucesor: withSuccessor.length,
        pct_cobertura: `${Math.round((withSuccessor.length / total) * 1000) / 10}%`,
        sin_sucesor: withoutSuccessor.length,
        pct_sin_sucesor: `${Math.round((withoutSuccessor.length / total) * 1000) / 10}%`
      },
      cargos_de_valor_criticos: {
        total: criticalRoles.length,
        cubiertos: criticalRoles.filter(r => r.tiene_sucesor === "Sí").length,
        sin_sucesor_alerta: criticalNoSuccessor.length,
        pct_cubiertos: `${Math.round((criticalRoles.filter(r => r.tiene_sucesor === "Sí").length / Math.max(criticalRoles.length, 1)) * 1000) / 10}%`
      },
      distribucion_riesgo_fuga: {
        riesgo_alto: highRisk.length,
        riesgo_medio: medRisk.length,
        riesgo_bajo: lowRisk.length,
        alertas_rojas_alto_sin_sucesor: imminentRedAlerts.length
      },
      pipeline_madurez_readiness: {
        inmediato_ready_now: readyNow.length,
        un_a_dos_anos: ready1to2.length,
        tres_a_cinco_anos: ready3to5.length
      },
      distribucion_9box_resumen: {
        box_9_futuro_lider: topTalentBox9.length,
        box_8_alto_potencial: topTalentBox8.length,
        box_5_profesional_clave: keyPlayersBox5.length,
        total_top_talent_box_8_y_9: topTalentBox8.length + topTalentBox9.length
      },
      calidad_motivacional_sucesores: {
        alta: motHigh.length,
        media_atencion: motMed.length,
        baja_alerta_roja: motLow.length
      }
    },
    resumen_empresas: companyDigest,
    alertas_rojas_inminentes: imminentRedAlerts.map(r => `${r.nombre} | ${r.empresa} | ${r.posicion} | GGS ${r.ggs} | ${r.tiempo_posicion}`),
    foco_especifico_consulta: focusDetails
  };
}

async function callGeminiApiLive(userQuery, history = [], records = [], apiKey = "") {
  const key = (apiKey || "").trim();
  if (!key) throw new Error("No hay API Key configurada.");

  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const digestedDoc = digestTalentDocumentForLLM(userQuery, records);

  const systemPrompt = `Eres el Director de Talento & Asesor Estratégico Senior de Sucesión para Grupo Breca y Centria.
Tu misión es asesorar al Comité de Talento y a los Directores Ejecutivos analizando el documento oficial digerido de 2026_Reporte_Sucesion.xlsx.

DOCUMENTO DIGERIDO OFICIAL DE SUCESIÓN (GRUPO BRECA 2026):
${JSON.stringify(digestedDoc, null, 2)}

DIRECTIVAS OBLIGATORIAS:
1. Lenguaje: Responde en español formal, estratégico y ejecutivo para el Comité de Talento.
2. Fidelidad de Datos: Utiliza nombres exactos de personas, posiciones, empresas, niveles GGS y puntuaciones 9-Box que figuran en el documento digerido. NUNCA inventes nombres ni métricas.
3. Estructura de Análisis Abierto:
   - 📌 Diagnóstico Ejecutivo & Hallazgos Clave (respaldo con métricas y causas raíz).
   - ⚠️ Evaluación de Impacto y Riesgos Ocultos (continuidad operacional, efecto dominó de vacantes, pérdida de conocimiento crítico).
   - 🚀 Plan de Acción Priorizado (Inmediato 30 días, Corto plazo 90 días, Mediano plazo 6 meses).
   - 💡 Recomendación Estratégica para el Comité de Talento.
4. Formato Visual Centria:
   - Genera HTML semántico limpio y visual:
     <div class="ai-structured-response"><div class="ai-html-card"><div class="ai-html-body nexia-markdown">...</div></div></div>
   - Puedes usar <div class="ai-kpi-grid"> con <div class="ai-kpi-box">, badges como <span class="ai-badge ai-badge-navy">, y tablas con <div class="ai-table-wrap"><table class="ai-table">.
   - NUNCA uses atributos inline 'style='.`;

  const contents = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-4)) {
      if (h.role === "user") {
        contents.push({ role: "user", parts: [{ text: h.content }] });
      } else if (h.role === "assistant") {
        const clean = h.content.replace(/<[^>]+>/g, " ").trim().slice(0, 300);
        if (clean) contents.push({ role: "model", parts: [{ text: clean }] });
      }
    }
  }
  contents.push({ role: "user", parts: [{ text: userQuery }] });

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: contents,
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 2048
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return replyText;
}

function streamTypewriterContent(targetElement, fullHtml, isLinear = false, onComplete = null) {
  if (!targetElement) return;

  if (isLinear) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = fullHtml;
    const text = tempDiv.textContent || tempDiv.innerText || "";
    
    targetElement.innerHTML = `<p class="ai-linear-response"><span class="typewriter-text"></span><span class="ai-streaming-cursor">|</span></p>`;
    const textSpan = targetElement.querySelector(".typewriter-text");
    const cursor = targetElement.querySelector(".ai-streaming-cursor");
    const container = document.getElementById("chat-messages-container");

    let idx = 0;
    const speed = Math.max(8, Math.min(22, Math.floor(1200 / Math.max(text.length, 1))));
    
    const interval = setInterval(() => {
      if (idx < text.length) {
        idx += 2;
        if (textSpan) textSpan.textContent = text.slice(0, idx);
        if (container) container.scrollTop = container.scrollHeight;
      } else {
        clearInterval(interval);
        if (cursor) cursor.remove();
        targetElement.innerHTML = fullHtml;
        if (container) container.scrollTop = container.scrollHeight;
        if (typeof onComplete === "function") onComplete();
      }
    }, speed);
  } else {
    targetElement.classList.add("animate-fade-in");
    targetElement.innerHTML = fullHtml;
    const container = document.getElementById("chat-messages-container");
    if (container) container.scrollTop = container.scrollHeight;
    if (typeof onComplete === "function") onComplete();
  }
}

async function sendChatQuestion(questionText) {
  const q = String(questionText || "").trim();
  if (!q) return;

  const overlay = document.getElementById("chat-drawer-overlay");
  if (overlay && overlay.classList.contains("hidden")) {
    openChatDrawer();
  }

  const catalogPanel = document.getElementById("catalog-panel");
  if (catalogPanel) catalogPanel.classList.add("hidden");
  toggleQuickActions(true);

  const container = document.getElementById("chat-messages-container");
  const typing = document.getElementById("chat-typing-indicator");
  const typingText = document.getElementById("chat-typing-text");
  const input = document.getElementById("chat-input");
  if (input) input.value = "";

  const clientIntent =
    typeof window.classifyTalentQueryIntent === "function"
      ? window.classifyTalentQueryIntent(q, state.records)
      : { route: "TEMPLATE", routeLabel: "Plantilla Ejecutiva de Reporte" };

  const storedKey = getStoredGeminiKey();

  if (typingText) {
    if (clientIntent.route === "OPEN_ANALYSIS") {
      typingText.textContent = "🧠 Ejecutando análisis estratégico y proyectando tablas/gráficos a la izquierda...";
    } else {
      typingText.textContent = "⚡ Ejecutando plantilla ejecutiva y proyectando resultados a la izquierda...";
    }
  }

  // 1. Mostrar pregunta del usuario en el chat derecho
  if (container) {
    const userDiv = document.createElement("div");
    userDiv.className = "flex justify-end";
    userDiv.innerHTML = `
      <div class="breca-chat-user-bubble">
        ${escapeHtml(q)}
      </div>
    `;
    container.appendChild(userDiv);
    container.scrollTop = container.scrollHeight;
  }

  // 2. Insertar burbuja de estado en vivo en el chat ("⚙️ Ejecutando análisis...")
  let botDiv = null;
  if (container) {
    botDiv = document.createElement("div");
    botDiv.className = "flex items-start gap-2.5";
    botDiv.innerHTML = `
      <div class="breca-ai-avatar mt-0.5">
        IA
      </div>
      <div class="flex-1 min-w-0 target-content-area">
        <div class="ai-chat-exec-card">
          <div class="ai-chat-exec-header">
            <span class="ai-chat-status-pill ai-chat-status-running">
              <span>⚙️</span>
              <span>Ejecutando consulta sobre 101 posiciones...</span>
            </span>
          </div>
          <p class="text-xs text-breca-slate">Procesando indicadores de sucesión y preparando fichas, gráficos y tablas en el panel izquierdo...</p>
        </div>
      </div>
    `;
    container.appendChild(botDiv);
    container.scrollTop = container.scrollHeight;
  }

  if (typing) typing.classList.remove("hidden");

  let rawAnswer = "";
  let isLinear = false;
  let routeType = clientIntent.route || "TEMPLATE";
  let routeLabel = clientIntent.routeLabel || "Plantilla Ejecutiva de Reporte";
  let followUps = [];
  let isLiveGeminiResponse = false;

  try {
    const clientResult =
      typeof window.answerTalentQuestionClient === "function"
        ? window.answerTalentQuestionClient(q, state.records)
        : null;

    if (clientResult) {
      routeType = clientResult.route || routeType;
      routeLabel = clientResult.routeLabel || routeLabel;
      followUps = Array.isArray(clientResult.followUps) ? clientResult.followUps : [];
    }

    if (routeType === "OPEN_ANALYSIS" && storedKey) {
      try {
        const liveGeminiText = await callGeminiApiLive(q, state.chatHistory, state.records, storedKey);
        if (liveGeminiText) {
          rawAnswer = liveGeminiText;
          routeLabel = "Gemini 2.5 Flash · Análisis Estratégico en Vivo";
          isLiveGeminiResponse = true;
          isLinear = false;
        }
      } catch (geminiErr) {
        console.warn("Fallo temporal en Gemini Live API:", geminiErr);
        showToast("Gemini Live: " + (geminiErr.message || "Error de conexión") + ". Usando RAG local.", "info");
      }
    }

    if (!rawAnswer) {
      if (clientResult && clientResult.answer) {
        rawAnswer = clientResult.answer;
        isLinear = Boolean(clientResult.isLinear);
      } else {
        rawAnswer = '<p class="ai-linear-response">No se pudo procesar la consulta en este momento.</p>';
        isLinear = true;
      }
    }
  } catch (err) {
    console.error("Error procesando consulta:", err);
    rawAnswer = '<p class="ai-linear-response">Ocurrió un error al procesar la consulta en este momento.</p>';
    isLinear = true;
  } finally {
    if (typing) typing.classList.add("hidden");
  }

  const validated = validateAndSanitizeAgentHtml(rawAnswer, isLinear);

  state.chatHistory.push({ role: "user", content: q });
  state.chatHistory.push({ role: "assistant", content: validated.html });

  const targetArea = botDiv ? botDiv.querySelector(".target-content-area") : null;

  if (validated.isLinear) {
    // Respuesta puramente conversacional (ej. saludo o aclaración): se queda en el chat derecho
    if (targetArea) {
      targetArea.innerHTML = `<div class="chat-bubble-ai rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm"></div>`;
      const innerBox = targetArea.firstElementChild;
      streamTypewriterContent(innerBox, validated.html, true);
    }
  } else {
    // Respuesta elaborada: separar análisis textual (derecha) y gráficos/tablas/reporte (izquierda)
    const artifactId = "ART_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const splitResult = splitAgentResponseForWorkspace(
      validated.html,
      q,
      routeType,
      routeLabel,
      isLiveGeminiResponse,
      state.records,
      artifactId
    );

    const artifactObj = {
      id: artifactId,
      query: q,
      title: splitResult.reportTitle || q,
      routeType,
      routeLabel,
      isLiveGemini: isLiveGeminiResponse,
      canvasHtml: splitResult.canvasVisualHtml,
      followUps,
    };

    state.canvasArtifacts.push(artifactObj);
    renderActiveCanvasArtifact(artifactId);

    const isOpenRoute = routeType === "OPEN_ANALYSIS";
    const followUpChatHtml =
      followUps.length > 0
        ? `<div class="ai-followup-bar mt-1.5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-breca-slate mr-1">Continuar:</span>
            ${followUps
              .slice(0, 2)
              .map(
                (fq) =>
                  `<button type="button" data-followup-question="${escapeHtml(fq)}" class="ai-followup-chip">
                    <span>${isOpenRoute ? "⚡" : "🧠"}</span>
                    <span>${escapeHtml(fq)}</span>
                  </button>`
              )
              .join("")}
          </div>`
        : "";

    if (targetArea) {
      streamTypewriterContent(
        targetArea,
        splitResult.chatConversationalHtml + followUpChatHtml,
        false
      );
    }
  }
}

// ============================================================================
// MAPEO EXACTO DEL ARCHIVO EXCEL (2026_Reporte_Sucesion.xlsx - Hoja Talent Pool)
// ============================================================================
/**
 * Mapea las filas leídas desde SheetJS (XLSX.utils.sheet_to_json) respetando exactamente
 * las 15 columnas de negocio de 2026_Reporte_Sucesion.xlsx e ignorando __PowerAppsId__:
 *  B: Empresa
 *  C: __PowerAppsId__ (IGNORADO)
 *  D: Nº de documento
 *  E: Apellidos
 *  F: Nombre
 *  G: Nombre de la Posición
 *  H: Nivel de Posición
 *  I: GGS
 *  J: Cargo de Valor
 *  K: Tiempo de la persona en la posición actual
 *  L: 9box calibrado
 *  M: Riesgo de pérdida
 *  N: ¿Tiene sucesor?
 *  O: Nombre sucesor
 *  P: Motivación del sucesor
 *  Q: Readiness del sucesor
 */
function mapExcelRowsToRecords(rows) {
  return rows
    .map((row, index) => {
      // Construir mapa limpio de claves ignorando __PowerAppsId__
      const keyMap = {};
      for (const rawKey of Object.keys(row)) {
        const cleanKey = String(rawKey || "").trim().toLowerCase();
        if (!cleanKey || cleanKey.includes("powerappsid")) continue;
        keyMap[cleanKey] = row[rawKey];
      }

      const getExactOrPartial = (exactKeys = [], partialKeys = [], excludeSubstrings = []) => {
        for (const ek of exactKeys) {
          const target = ek.toLowerCase();
          if (keyMap[target] !== undefined && String(keyMap[target]).trim() !== "") {
            return String(keyMap[target]).trim();
          }
        }
        for (const [k, val] of Object.entries(keyMap)) {
          if (excludeSubstrings.some((ex) => k.includes(ex))) continue;
          if (partialKeys.some((pk) => k.includes(pk)) && String(val).trim() !== "") {
            return String(val).trim();
          }
        }
        return "";
      };

      const empresa = getExactOrPartial(["empresa"], ["empresa", "unidad", "compañía", "compania"]);
      const documento = getExactOrPartial(["nº de documento", "n° de documento", "documento", "dni"], ["documento", "dni"]);
      const apellidos = getExactOrPartial(["apellidos", "apellido"], ["apellido"]);
      const nombreCorto = getExactOrPartial(
        ["nombre"],
        ["nombre"],
        ["posición", "posicion", "sucesor", "talento", "completo"]
      );
      const nombreTalentoCol = getExactOrPartial(
        ["nombre del talento", "nombre completo", "talento"],
        ["nombre del talento", "nombre completo", "talento", "empleado"]
      );

      const fullName =
        nombreTalentoCol ||
        [nombreCorto, apellidos].filter(Boolean).join(" ").trim() ||
        getExactOrPartial(["nombre"], ["nombre"], ["posición", "posicion", "sucesor"]);

      const posicion = getExactOrPartial(
        ["nombre de la posición", "nombre de la posicion", "posición", "posicion", "cargo"],
        ["nombre de la posición", "nombre de la posicion", "posición", "posicion", "puesto"]
      );
      const nivel = getExactOrPartial(["nivel de posición", "nivel de posicion", "nivel"], ["nivel"]) || "N-2";
      const ggs = getExactOrPartial(["ggs"], ["ggs", "grado"]);
      const cargoValor = getExactOrPartial(["cargo de valor"], ["cargo de valor", "crítico", "critico"]);
      const tiempoPosicion = getExactOrPartial(
        ["tiempo de la persona en la posición actual", "tiempo en posición", "tiempo en posicion"],
        ["tiempo"]
      );
      const nineBox = getExactOrPartial(["9box calibrado", "9box", "9-box"], ["9box", "9-box", "cuadrante"]);
      const riesgo = getExactOrPartial(["riesgo de pérdida", "riesgo de perdida", "riesgo"], ["riesgo"]);
      const tieneSucesorRaw = getExactOrPartial(
        ["¿tiene sucesor?", "tiene sucesor"],
        ["tiene sucesor"]
      );
      const nombreSucesor = getExactOrPartial(
        ["nombre sucesor", "nombre del sucesor", "sucesor"],
        ["nombre sucesor", "nombre del sucesor", "sucesor"],
        ["tiene", "readiness", "motivación", "motivacion"]
      );
      const motivacionSucesor = getExactOrPartial(
        ["motivación del sucesor", "motivacion del sucesor"],
        ["motivación", "motivacion"]
      );
      const readiness = getExactOrPartial(
        ["readiness del sucesor", "readiness"],
        ["readiness", "preparación", "preparacion"]
      );

      const tieneSucesorClean = tieneSucesorRaw.toLowerCase();
      const sinSucesorExplicito = ["no", "false", "0"].includes(tieneSucesorClean);
      const sucesorFinal =
        sinSucesorExplicito || !nombreSucesor || ["-", "sin sucesor", "no tiene", "n/a", "ninguno"].includes(nombreSucesor.toLowerCase())
          ? "Sin sucesor"
          : nombreSucesor;

      return {
        id: index + 1,
        fila_excel: index + 2,
        documento,
        empresa: empresa || "Centria",
        nombre: fullName,
        nombre_corto: nombreCorto,
        apellidos,
        nombre_completo: fullName,
        posicion,
        nivel,
        ggs,
        tiempo_posicion: tiempoPosicion,
        cargo_valor: cargoValor,
        nine_box: nineBox,
        riesgo,
        tiene_sucesor: sucesorFinal === "Sin sucesor" ? "No" : "Sí",
        sucesor: sucesorFinal,
        readiness: sucesorFinal === "Sin sucesor" ? "-" : readiness,
        motivacion_sucesor: sucesorFinal === "Sin sucesor" ? "-" : motivacionSucesor || "-",
      };
    })
    .filter((r) => Boolean(r.nombre || r.posicion));
}

async function syncRecordsToBackendIfAvailable() {
  // Operación local en memoria (100% estático para GitHub Pages)
}

// ============================================================================
// EXCEL IMPORT / EXPORT Y CRUD MODAL
// ============================================================================
function handleExcelUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames.includes("Talent Pool") ? "Talent Pool" : workbook.SheetNames[0];
      const targetSheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(targetSheet, { defval: "" });

      if (!rows.length) {
        showToast("El archivo Excel está vacío", "error");
        return;
      }

      const mapped = mapExcelRowsToRecords(rows);
      state.records = normalizeClientRecords(mapped);
      await syncRecordsToBackendIfAvailable();
      refreshMetadataLists();
      clearAllFilters();
      showToast(`Excel actualizado en vivo (${state.records.length} talentos mapeados)`, "success");
    } catch (err) {
      console.error("Error leyendo Excel:", err);
      showToast("No se pudo leer el archivo Excel", "error");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsArrayBuffer(file);
}

function exportToExcel() {
  if (!window.XLSX) {
    showToast("Librería SheetJS no disponible", "error");
    return;
  }

  // Exporta exactamente las 15 columnas oficiales de negocio de 2026_Reporte_Sucesion.xlsx
  const exportRows = state.filteredRecords.map((r) => ({
    Empresa: r.empresa,
    "Nº de documento": r.documento || "",
    Apellidos: r.apellidos || "",
    Nombre: r.nombre_corto || r.nombre,
    "Nombre de la Posición": r.posicion,
    "Nivel de Posición": r.nivel,
    GGS: r.ggs,
    "Cargo de Valor": r.cargo_valor,
    "Tiempo de la persona en la posición actual": r.tiempo_posicion,
    "9box calibrado": r.nine_box,
    "Riesgo de pérdida": r.riesgo,
    "¿Tiene sucesor?": hasSuccessorRecord(r) ? "Sí" : "No",
    "Nombre sucesor": hasSuccessorRecord(r) ? r.sucesor : "-",
    "Motivación del sucesor": hasSuccessorRecord(r) ? r.motivacion_sucesor || "-" : "-",
    "Readiness del sucesor": hasSuccessorRecord(r) ? r.readiness : "-",
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Talent Pool");
  XLSX.writeFile(wb, "2026_Reporte_Sucesion_Export.xlsx");
  showToast(`Exportados ${exportRows.length} registros con estructura oficial`, "success");
}

function openTalentModal(record = null) {
  const overlay = document.getElementById("talent-modal-overlay");
  const title = document.getElementById("talent-modal-title");
  if (!overlay) return;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  if (record) {
    if (title) title.textContent = `Editar Talento: ${record.nombre}`;
    setVal("form-talent-id", record.id);
    setVal("form-empresa", record.empresa);
    setVal("form-documento", record.documento || "");
    setVal("form-nombre", record.nombre);
    setVal("form-posicion", record.posicion);
    setVal("form-nivel", record.nivel || "N-2");
    setVal("form-ggs", record.ggs);
    setVal("form-9box", record.nine_box);
    setVal("form-riesgo", record.riesgo);
    setVal("form-cargo-valor", record.cargo_valor);
    setVal("form-tiempo", record.tiempo_posicion || "");
    setVal("form-sucesor", record.sucesor);
    setVal("form-readiness", hasSuccessorRecord(record) ? record.readiness : "-");
    setVal("form-motivacion", hasSuccessorRecord(record) && record.motivacion_sucesor ? record.motivacion_sucesor : "-");
  } else {
    if (title) title.textContent = "Registrar Nuevo Talento";
    setVal("form-talent-id", "");
    setVal("form-empresa", state.selectedCompany !== "ALL" ? state.selectedCompany : "Centria");
    setVal("form-documento", "");
    setVal("form-nombre", "");
    setVal("form-posicion", "");
    setVal("form-nivel", "N-2");
    setVal("form-ggs", "15");
    setVal("form-9box", "8");
    setVal("form-riesgo", "Medio");
    setVal("form-cargo-valor", "Sí");
    setVal("form-tiempo", "1 año, 6 meses");
    setVal("form-sucesor", "Sin sucesor");
    setVal("form-readiness", "-");
    setVal("form-motivacion", "-");
  }

  overlay.classList.remove("hidden");
}

function closeTalentModal() {
  const overlay = document.getElementById("talent-modal-overlay");
  if (overlay) overlay.classList.add("hidden");
}

/**
 * MODO 1 (Fuera del Agente IA): Abre la Ficha de Valoración Ejecutiva Ecualizada
 * en una ventana flotante dedicada con las 4 columnas en una sola fila (1x4).
 */
function openFichaModal(record) {
  if (!record) return;
  const overlay = document.getElementById("ficha-modal-overlay");
  const titleEl = document.getElementById("ficha-modal-title");
  const subtitleEl = document.getElementById("ficha-modal-subtitle");
  const bodyEl = document.getElementById("ficha-modal-body");
  if (!overlay || !bodyEl) return;

  state.activeFichaRecord = record;

  if (titleEl) {
    titleEl.textContent = `Valoración Ejecutiva Ecualizada · ${record.nombre}`;
  }
  if (subtitleEl) {
    subtitleEl.textContent = `${record.posicion} · ${record.empresa} · Nivel ${record.nivel} (GGS ${record.ggs}) · Vista de Presentación 4 Columnas`;
  }

  const fichaHtml =
    typeof window.CENTRIA_BUILD_FICHA_HTML === "function"
      ? window.CENTRIA_BUILD_FICHA_HTML(record)
      : "";

  bodyEl.innerHTML = fichaHtml;
  overlay.classList.remove("hidden");
}

function closeFichaModal() {
  const overlay = document.getElementById("ficha-modal-overlay");
  if (overlay) overlay.classList.add("hidden");
}

async function saveTalentFromModal(e) {
  e.preventDefault();
  const idVal = document.getElementById("form-talent-id").value;
  const fullName = document.getElementById("form-nombre").value.trim();
  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const sucesorRaw = document.getElementById("form-sucesor").value.trim() || "Sin sucesor";
  const tieneSucesor = sucesorRaw.toLowerCase() !== "sin sucesor" && sucesorRaw !== "-";
  let readinessVal = document.getElementById("form-readiness").value;
  if (!tieneSucesor) readinessVal = "-";
  if (tieneSucesor && readinessVal === "-") readinessVal = "1 a 3 años";

  const motivacionRaw = document.getElementById("form-motivacion")?.value || "Alta";
  const motivacionVal = tieneSucesor ? (motivacionRaw === "-" ? "Alta" : motivacionRaw) : "-";
  const docRaw = document.getElementById("form-documento")?.value.trim() || "";

  const payload = {
    id: idVal ? Number(idVal) : Date.now(),
    documento: docRaw || undefined,
    empresa: document.getElementById("form-empresa").value.trim() || "Centria",
    nombre: fullName,
    nombre_corto: firstName,
    apellidos: lastName,
    nombre_completo: fullName,
    posicion: document.getElementById("form-posicion").value.trim(),
    nivel: document.getElementById("form-nivel").value,
    ggs: Number(document.getElementById("form-ggs").value) || 15,
    nine_box: Number(document.getElementById("form-9box").value) || 5,
    riesgo: document.getElementById("form-riesgo").value,
    cargo_valor: document.getElementById("form-cargo-valor").value,
    tiempo_posicion: document.getElementById("form-tiempo").value.trim() || "-",
    tiene_sucesor: tieneSucesor ? "Sí" : "No",
    sucesor: tieneSucesor ? sucesorRaw : "Sin sucesor",
    readiness: readinessVal,
    motivacion_sucesor: motivacionVal,
  };

  const normalized = normalizeClientRecords([payload])[0];

  if (idVal) {
    const idx = state.records.findIndex((r) => String(r.id) === String(idVal));
    if (idx !== -1) {
      state.records[idx] = { ...state.records[idx], ...normalized, fila_excel: state.records[idx].fila_excel };
      showToast(`Dashboard y tabla actualizados: ${normalized.nombre}`, "success");
    }
  } else {
    state.records.unshift(normalized);
    showToast(`Nuevo talento incorporado al Dashboard: ${normalized.nombre}`, "success");
  }

  await syncRecordsToBackendIfAvailable();
  refreshMetadataLists();
  applyFiltersAndRender();
  closeTalentModal();
}

// ============================================================================
// FILTROS RÁPIDOS, TABS DEL HEADER Y EVENT LISTENERS
// ============================================================================
function clearAllFilters() {
  state.searchQuery = "";
  state.filterRisk = "ALL";
  state.filter9Box = "ALL";
  state.filterReadiness = "ALL";
  state.filterCritical = "ALL";
  state.filterGGS = "ALL";
  state.activePreset = null;
  state.activeKpiFilter = "ALL";
  state.currentPage = 1;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  setVal("search-input", "");
  setVal("filter-risk", "ALL");
  setVal("filter-9box", "ALL");
  setVal("filter-readiness", "ALL");
  setVal("filter-critical", "ALL");
  setVal("filter-ggs", "ALL");

  applyFiltersAndRender();
}

function applyPresetFilter(preset) {
  if (state.activePreset === preset) {
    clearAllFilters();
    return;
  }

  clearAllFilters();
  state.activePreset = preset;

  if (preset === "high-risk-no-successor") {
    state.filterRisk = "Alto";
    state.filterReadiness = "NO_SUCCESSOR";
    state.activeKpiFilter = "CRITICAL_RISK";
  } else if (preset === "critical-no-successor") {
    state.filterCritical = "Sí";
    state.filterReadiness = "NO_SUCCESSOR";
  } else if (preset === "ready-now") {
    state.filterReadiness = "Inmediato";
    state.activeKpiFilter = "READY_NOW";
  } else if (preset === "top-9box-no-successor") {
    state.filter9Box = "TOP";
    state.filterReadiness = "NO_SUCCESSOR";
  } else if (preset === "high-risk-over-3y") {
    state.filterRisk = "Alto";
    state.filterReadiness = "OVER_3_YEARS";
  }

  const setIf = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  setIf("filter-risk", state.filterRisk);
  setIf("filter-9box", state.filter9Box);
  setIf("filter-readiness", state.filterReadiness);
  setIf("filter-critical", state.filterCritical);

  switchTab("table");
  applyFiltersAndRender();
}

function switchTab(tabName) {
  state.activeTab = tabName;
  const tablePanel = document.getElementById("panel-table-view");
  const analyticsPanel = document.getElementById("panel-analytics-view");
  const btnTable = document.getElementById("tab-btn-table");
  const btnAnalytics = document.getElementById("tab-btn-analytics");

  if (tabName === "table") {
    tablePanel?.classList.remove("hidden");
    analyticsPanel?.classList.add("hidden");
    if (btnTable) {
      btnTable.classList.add("header-tab-active");
      btnTable.classList.remove("header-tab-inactive");
    }
    if (btnAnalytics) {
      btnAnalytics.classList.add("header-tab-inactive");
      btnAnalytics.classList.remove("header-tab-active");
    }
  } else {
    tablePanel?.classList.add("hidden");
    analyticsPanel?.classList.remove("hidden");
    if (btnAnalytics) {
      btnAnalytics.classList.add("header-tab-active");
      btnAnalytics.classList.remove("header-tab-inactive");
    }
    if (btnTable) {
      btnTable.classList.add("header-tab-inactive");
      btnTable.classList.remove("header-tab-active");
    }
    updateLiveCharts(
      state.selectedCompany === "ALL"
        ? state.records
        : state.records.filter((r) => r.empresa === state.selectedCompany)
    );
  }
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  const variantClass =
    type === "error"
      ? "breca-toast-error"
      : type === "success"
      ? "breca-toast-success"
      : "breca-toast-info";

  toast.className = `breca-toast ${variantClass}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function bindEventListeners() {
  document.getElementById("global-company-select")?.addEventListener("change", (e) => {
    state.selectedCompany = e.target.value;
    state.currentPage = 1;
    applyFiltersAndRender();
  });

  // 4 Tarjetas KPI interactivas
  document.getElementById("kpi-card-all")?.addEventListener("click", () => {
    clearAllFilters();
    switchTab("table");
  });

  document.getElementById("kpi-card-coverage")?.addEventListener("click", () => {
    clearAllFilters();
    state.filterReadiness = "NO_SUCCESSOR";
    state.activeKpiFilter = "NO_SUCCESSOR";
    const el = document.getElementById("filter-readiness");
    if (el) el.value = "NO_SUCCESSOR";
    switchTab("table");
    applyFiltersAndRender();
  });

  document.getElementById("kpi-card-ready")?.addEventListener("click", () => {
    applyPresetFilter("ready-now");
  });

  document.getElementById("kpi-card-critical")?.addEventListener("click", () => {
    applyPresetFilter("high-risk-no-successor");
  });

  // Tabs integrados en el Header
  document.getElementById("tab-btn-analytics")?.addEventListener("click", () => switchTab("analytics"));
  document.getElementById("tab-btn-table")?.addEventListener("click", () => switchTab("table"));

  // Buscador y Selectores de Filtro
  document.getElementById("search-input")?.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    state.currentPage = 1;
    applyFiltersAndRender();
  });

  document.getElementById("filter-risk")?.addEventListener("change", (e) => {
    state.filterRisk = e.target.value;
    state.activePreset = null;
    state.currentPage = 1;
    applyFiltersAndRender();
  });

  document.getElementById("filter-9box")?.addEventListener("change", (e) => {
    state.filter9Box = e.target.value;
    state.activePreset = null;
    state.currentPage = 1;
    applyFiltersAndRender();
  });

  document.getElementById("filter-readiness")?.addEventListener("change", (e) => {
    state.filterReadiness = e.target.value;
    state.activePreset = null;
    state.currentPage = 1;
    applyFiltersAndRender();
  });

  document.getElementById("filter-critical")?.addEventListener("change", (e) => {
    state.filterCritical = e.target.value;
    state.activePreset = null;
    state.currentPage = 1;
    applyFiltersAndRender();
  });

  document.getElementById("btn-clear-filters")?.addEventListener("click", clearAllFilters);

  document.querySelectorAll(".preset-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.getAttribute("data-preset");
      if (preset) applyPresetFilter(preset);
    });
  });

  // Paginación
  document.getElementById("page-size-select")?.addEventListener("change", (e) => {
    state.pageSize = Number(e.target.value) || 12;
    state.currentPage = 1;
    applyFiltersAndRender();
  });

  document.getElementById("btn-prev-page")?.addEventListener("click", () => {
    if (state.currentPage > 1) {
      state.currentPage -= 1;
      renderTable();
    }
  });

  document.getElementById("btn-next-page")?.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(state.filteredRecords.length / state.pageSize));
    if (state.currentPage < totalPages) {
      state.currentPage += 1;
      renderTable();
    }
  });

  // Delegación de eventos en Tabla (Ficha Ejecutiva, Edición y Eliminación)
  document.getElementById("talent-table-body")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    const rec = state.records.find((r) => String(r.id) === String(id));
    if (!rec) return;

    if (action === "ficha") {
      openFichaModal(rec);
    } else if (action === "edit") {
      openTalentModal(rec);
    } else if (action === "delete") {
      state.records = state.records.filter((r) => String(r.id) !== String(id));
      syncRecordsToBackendIfAvailable();
      refreshMetadataLists();
      applyFiltersAndRender();
      showToast(`Eliminado: ${rec.nombre}`, "info");
    }
  });

  // Delegación de eventos en el Dashboard Analítico
  document.getElementById("ninebox-matrix-container")?.addEventListener("click", (e) => {
    const cell = e.target.closest("button[data-9box-cell]");
    if (!cell) return;
    const box = cell.getAttribute("data-9box-cell");
    state.filter9Box = String(state.filter9Box) === String(box) ? "ALL" : box;
    const sel = document.getElementById("filter-9box");
    if (sel) sel.value = state.filter9Box;
    switchTab("table");
    applyFiltersAndRender();
  });

  document.getElementById("critical-alerts-list")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    const rec = state.records.find((r) => String(r.id) === String(id));
    if (!rec) return;
    if (action === "ficha") {
      openFichaModal(rec);
    } else if (action === "edit-critical") {
      openTalentModal(rec);
    }
  });

  document.getElementById("company-breakdown-container")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-company-chip]");
    if (!btn) return;
    const comp = btn.getAttribute("data-company-chip");
    state.selectedCompany = state.selectedCompany === comp ? "ALL" : comp;
    const sel = document.getElementById("global-company-select");
    if (sel) sel.value = state.selectedCompany;
    state.currentPage = 1;
    applyFiltersAndRender();
  });

  // Excel Import / Export / Reload / Nuevo
  document.getElementById("btn-upload-excel")?.addEventListener("click", () => {
    document.getElementById("excel-file-input")?.click();
  });
  document.getElementById("excel-file-input")?.addEventListener("change", handleExcelUpload);
  document.getElementById("btn-export-excel")?.addEventListener("click", exportToExcel);
  document.getElementById("btn-reload-source")?.addEventListener("click", () => {
    const initial = Array.isArray(window.CENTRIA_INITIAL_DATA) ? window.CENTRIA_INITIAL_DATA : [];
    state.records = normalizeClientRecords(initial);
    refreshMetadataLists();
    clearAllFilters();
    showToast("Restaurados los 101 registros originales del reporte", "success");
  });

  document.getElementById("btn-new-talent")?.addEventListener("click", () => openTalentModal(null));
  document.getElementById("btn-close-talent-modal")?.addEventListener("click", closeTalentModal);
  document.getElementById("btn-cancel-talent-modal")?.addEventListener("click", closeTalentModal);
  document.getElementById("talent-modal-backdrop")?.addEventListener("click", closeTalentModal);
  document.getElementById("talent-crud-form")?.addEventListener("submit", saveTalentFromModal);

  // Modal Flotante de Ficha Ejecutiva (Modo 1: Fuera del Agente IA, 4 columnas en fila)
  document.getElementById("btn-close-ficha-modal")?.addEventListener("click", closeFichaModal);
  document.getElementById("ficha-modal-backdrop")?.addEventListener("click", closeFichaModal);
  document.getElementById("btn-ficha-open-in-agent")?.addEventListener("click", () => {
    const rec = state.activeFichaRecord;
    closeFichaModal();
    openChatDrawer();
    if (rec) {
      sendChatQuestion(`Genera la ficha ejecutiva de ${rec.nombre} de ${rec.empresa}.`);
    }
  });

  // Agente IA: FAB abre/reanuda, Minimizar o clic fuera preserva, Cerrar/Nueva sesión reinicia
  
  // Modal de Configuración Google Gemini API Key (Manejado por detrás)
  document.getElementById("btn-fab-chat")?.addEventListener("click", openChatDrawer);
  document.getElementById("btn-minimize-chat")?.addEventListener("click", minimizeChatDrawer);
  document.getElementById("chat-drawer-backdrop")?.addEventListener("click", minimizeChatDrawer);
  document.getElementById("btn-close-chat")?.addEventListener("click", closeChatDrawer);

  // Botón de Nueva Sesión dentro del Agente IA
  document.getElementById("btn-new-session")?.addEventListener("click", () => {
    startNewChatSession();
    showToast("Nueva sesión iniciada", "info");
  });

  document.getElementById("btn-mode-templates")?.addEventListener("click", () => {
    setQuickActionsMode("templates");
  });
  document.getElementById("btn-mode-open")?.addEventListener("click", () => {
    setQuickActionsMode("open");
  });

  document.getElementById("btn-toggle-quick-actions")?.addEventListener("click", () => {
    toggleQuickActions();
  });
  document.getElementById("btn-collapse-quick-actions")?.addEventListener("click", () => {
    toggleQuickActions();
  });

  document.getElementById("btn-toggle-catalog")?.addEventListener("click", () => {
    document.getElementById("catalog-panel")?.classList.toggle("hidden");
  });
  document.getElementById("btn-close-catalog")?.addEventListener("click", () => {
    document.getElementById("catalog-panel")?.classList.add("hidden");
  });

  // Controles de Vista Dividida (Conmutador móvil, Panorama Base e Historial de Reportes en el Lienzo Izquierdo)
  document.getElementById("btn-mobile-view-chat")?.addEventListener("click", () => {
    switchMobileWorkspaceTab("chat");
  });
  document.getElementById("btn-mobile-view-canvas")?.addEventListener("click", () => {
    switchMobileWorkspaceTab("canvas");
  });
  document.getElementById("btn-canvas-home")?.addEventListener("click", () => {
    renderCanvasHomeOverview();
  });
  document.getElementById("btn-close-active-artifact")?.addEventListener("click", () => {
    if (state.activeArtifactId && state.activeArtifactId !== "HOME") {
      deleteCanvasArtifact(state.activeArtifactId);
    }
  });
  document.getElementById("ai-canvas-history-list")?.addEventListener("click", (e) => {
    const delBtn = e.target.closest("button[data-delete-artifact]");
    if (delBtn) {
      e.stopPropagation();
      deleteCanvasArtifact(delBtn.getAttribute("data-delete-artifact"));
      return;
    }
    const btn = e.target.closest("button[data-artifact-id]");
    if (!btn) return;
    renderActiveCanvasArtifact(btn.getAttribute("data-artifact-id"));
  });
  document.getElementById("ai-canvas-body")?.addEventListener("click", (e) => {
    const qBtn = e.target.closest("button[data-quick-question]");
    if (qBtn) {
      sendChatQuestion(qBtn.getAttribute("data-quick-question"));
      return;
    }
    const fBtn = e.target.closest("button[data-followup-question]");
    if (fBtn) {
      sendChatQuestion(fBtn.getAttribute("data-followup-question"));
    }
  });

  document.getElementById("quick-actions-grid")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-quick-question]");
    if (!btn) return;
    sendChatQuestion(btn.getAttribute("data-quick-question"));
  });

  document.getElementById("catalog-questions-container")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-catalog-question]");
    if (!btn) return;
    sendChatQuestion(btn.getAttribute("data-catalog-question"));
  });

  document.getElementById("chat-messages-container")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-expand-quick]");
    if (btn) {
      toggleQuickActions(false);
      return;
    }
    const focusBtn = e.target.closest("button[data-focus-artifact]");
    if (focusBtn) {
      const artId = focusBtn.getAttribute("data-focus-artifact");
      renderActiveCanvasArtifact(artId);
      if (window.innerWidth < 1024) {
        switchMobileWorkspaceTab("canvas");
      }
      return;
    }
    const followupBtn = e.target.closest("button[data-followup-question]");
    if (followupBtn) {
      sendChatQuestion(followupBtn.getAttribute("data-followup-question"));
    }
  });

  document.getElementById("chat-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("chat-input");
    if (!input) return;
    sendChatQuestion(input.value);
  });

  document.getElementById("chat-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const input = document.getElementById("chat-input");
      if (input) sendChatQuestion(input.value);
    }
  });
}
