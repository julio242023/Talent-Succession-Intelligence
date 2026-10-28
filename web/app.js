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
  quickActionsCollapsed: false,
  quickActionsMode: "templates",
  chatHistory: [],
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

// Metadata semántica de los 9 cuadrantes 9-Box
const NINE_BOX_META = {
  9: { name: "Estrella / Top Talent", short: "Top Talent", badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200", cellClass: "bg-emerald-50/70 border-emerald-300 text-emerald-950" },
  8: { name: "Alto Potencial", short: "Alto Potencial", badgeClass: "bg-teal-50 text-teal-800 border-teal-200", cellClass: "bg-teal-50/70 border-teal-300 text-teal-950" },
  7: { name: "Enigma / Potencial", short: "Enigma", badgeClass: "bg-sky-50 text-sky-800 border-sky-200", cellClass: "bg-sky-50/70 border-sky-300 text-sky-950" },
  6: { name: "Futuro Líder", short: "Futuro Líder", badgeClass: "bg-blue-50 text-blue-800 border-blue-200", cellClass: "bg-blue-50/70 border-blue-200 text-blue-950" },
  5: { name: "Talento Clave (Core)", short: "Talento Clave", badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200", cellClass: "bg-indigo-50/60 border-indigo-200 text-indigo-950" },
  4: { name: "Profesional Confiable", short: "Confiable", badgeClass: "bg-slate-100 text-slate-700 border-slate-200", cellClass: "bg-slate-50 border-slate-200 text-slate-800" },
  3: { name: "Especialista Efectivo", short: "Especialista", badgeClass: "bg-amber-50 text-amber-800 border-amber-200", cellClass: "bg-amber-50/60 border-amber-200 text-amber-950" },
  2: { name: "En Observación", short: "Observación", badgeClass: "bg-orange-50 text-orange-800 border-orange-200", cellClass: "bg-orange-50/60 border-orange-200 text-orange-950" },
  1: { name: "Bajo Desempeño", short: "Bajo Desemp.", badgeClass: "bg-rose-50 text-rose-800 border-rose-200", cellClass: "bg-rose-50/60 border-rose-200 text-rose-950" },
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
  try {
    const res = await fetch("/api/data");
    if (!res.ok) throw new Error("Modo estático activo");
    const data = await res.json();
    state.records = normalizeClientRecords(data.records || []);
  } catch (_err) {
    // Modo estático autónomo para GitHub Pages (datos embebidos del Excel oficial)
    const fallbackData = Array.isArray(window.CENTRIA_INITIAL_DATA) ? window.CENTRIA_INITIAL_DATA : [];
    state.records = normalizeClientRecords(fallbackData);
  }

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
    companySelect.innerHTML = `<option value="ALL" class="text-slate-900 font-semibold">Todas las Empresas (${state.records.length})</option>`;
    state.companies.forEach((comp) => {
      const count = state.records.filter((r) => r.empresa === comp).length;
      const opt = document.createElement("option");
      opt.value = comp;
      opt.className = "text-slate-900";
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
    covSub.innerHTML = `${withSuccessor} con sucesor · <span class="text-rose-600 font-semibold">${withoutSuccessor} sin sucesor</span>`;
  }

  setTxt("kpi-ready-now", readyNow);
  setTxt("kpi-ready-pct", `${readyPct}% Ready Now`);
  setTxt("kpi-top-talent", topTalent);
  setTxt("kpi-top-talent-sub", `${topTalentPct}%`);

  setTxt("kpi-high-risk", highRisk);
  setTxt("kpi-critical-no-succ", `🚨 ${highRiskNoSucc} en riesgo alto sin sucesor`);
  setTxt("table-count-pill", state.filteredRecords.length);
  setTxt("header-table-count", state.filteredRecords.length);

  // Actualizar dinámicamente los contadores de los 5 filtros rápidos (Presets) según el alcance activo
  const criticalNoSuccCount = scopeRecords.filter((r) => r.cargo_valor === "Sí" && !hasSuccessorRecord(r)).length;
  const top9BoxNoSuccCount = scopeRecords.filter((r) => r.nine_box >= 8 && !hasSuccessorRecord(r)).length;
  const highRiskOver3yCount = scopeRecords.filter(
    (r) => r.riesgo === "Alto" && ["3 a 5 años", "+ de 5 años"].includes(r.readiness)
  ).length;

  const presetLabels = {
    "high-risk-no-successor": `🚨 Riesgo Alto Sin Sucesor (${highRiskNoSucc})`,
    "critical-no-successor": `🛡️ Cargos de Valor Sin Sucesor (${criticalNoSuccCount})`,
    "ready-now": `🟢 Sucesión Inmediata (${readyNow})`,
    "top-9box-no-successor": `🌟 9-Box 8/9 Sin Sucesor (${top9BoxNoSuccCount})`,
    "high-risk-over-3y": `⏳ Riesgo Alto + Readiness >3a (${highRiskOver3yCount})`,
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
            class="ninebox-cell ${meta.cellClass} ${isActive ? "ninebox-cell-active" : ""} border rounded-xl p-4 sm:p-5 text-left flex flex-col justify-between min-h-[124px]"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="text-xs font-extrabold uppercase tracking-wider opacity-80">Cuadrante ${box}</span>
              <span class="text-xs font-bold px-2 py-0.5 rounded-md bg-white/85 tabular-nums shadow-sm">${pct}%</span>
            </div>
            <div class="my-2">
              <div class="text-3xl font-extrabold tabular-nums leading-none">${count}</div>
              <div class="text-xs font-bold mt-1.5 truncate">${meta.name}</div>
            </div>
            <div class="text-[11px] opacity-85 font-semibold pt-1 border-t border-current/10">
              ${noSucc > 0 ? `⚠️ ${noSucc} sin sucesor` : `✅ Cobertura completa`}
            </div>
          </button>
        `;
      })
      .join("");
  }

  // 2. Actualizar los 4 Gráficos Vivos en Chart.js
  updateLiveCharts(scope);

  // 2.b Poblar resúmenes ejecutivos debajo de los 4 gráficos vivos
  const riskDistEl = document.getElementById("risk-distribution-container");
  if (riskDistEl) {
    const riskItems = [
      { label: "Riesgo Alto", key: "Alto", badge: "bg-rose-50 text-rose-700 border-rose-200/80" },
      { label: "Riesgo Medio", key: "Medio", badge: "bg-amber-50 text-amber-800 border-amber-200/80" },
      { label: "Riesgo Bajo", key: "Bajo", badge: "bg-emerald-50 text-emerald-700 border-emerald-200/80" },
    ];
    riskDistEl.innerHTML = riskItems
      .map((item) => {
        const cnt = scope.filter((r) => r.riesgo === item.key).length;
        const pct = ((cnt / total) * 100).toFixed(1);
        return `
          <div class="p-2.5 rounded-xl border ${item.badge} text-center">
            <div class="text-lg font-extrabold tabular-nums leading-tight">${cnt}</div>
            <div class="text-[11px] font-bold mt-0.5">${item.label} (${pct}%)</div>
          </div>
        `;
      })
      .join("");
  }

  const readinessDistEl = document.getElementById("readiness-distribution-container");
  if (readinessDistEl) {
    const rdItems = [
      { label: "Inmediato", count: scope.filter((r) => hasSuccessorRecord(r) && r.readiness === "Inmediato").length, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      { label: "1 a 3 años", count: scope.filter((r) => hasSuccessorRecord(r) && r.readiness === "1 a 3 años").length, cls: "bg-blue-50 text-blue-700 border-blue-200" },
      { label: "3 a 5 años", count: scope.filter((r) => hasSuccessorRecord(r) && r.readiness === "3 a 5 años").length, cls: "bg-amber-50 text-amber-800 border-amber-200" },
      { label: "+ de 5 años", count: scope.filter((r) => hasSuccessorRecord(r) && r.readiness === "+ de 5 años").length, cls: "bg-orange-50 text-orange-800 border-orange-200" },
      { label: "Sin Sucesor", count: scope.filter((r) => !hasSuccessorRecord(r)).length, cls: "bg-rose-50 text-rose-700 border-rose-200" },
    ];
    readinessDistEl.innerHTML = rdItems
      .map(
        (it) => `
          <div class="p-2 rounded-xl border ${it.cls} text-center">
            <div class="text-base font-extrabold tabular-nums leading-tight">${it.count}</div>
            <div class="text-[10px] font-bold mt-0.5 truncate">${it.label}</div>
          </div>
        `
      )
      .join("");
  }

  const levelSummaryEl = document.getElementById("level-summary-container");
  if (levelSummaryEl) {
    const lvList = ["N-0", "N-1", "N-2", "N-3"];
    levelSummaryEl.innerHTML = lvList
      .map((lv) => {
        const totLv = scope.filter((r) => r.nivel === lv).length;
        const critLv = scope.filter((r) => r.nivel === lv && r.cargo_valor === "Sí").length;
        return `
          <div class="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 text-center">
            <div class="text-base font-extrabold text-[#0B2545] tabular-nums leading-tight">${totLv} <span class="text-xs font-bold text-slate-500">(${lv})</span></div>
            <div class="text-[10px] font-semibold text-indigo-700 mt-0.5">⭐ ${critLv} Cargos de Valor</div>
          </div>
        `;
      })
      .join("");
  }

  const companyBreakdownEl = document.getElementById("company-breakdown-container");
  if (companyBreakdownEl) {
    companyBreakdownEl.innerHTML = state.companies
      .map((comp) => {
        const cnt = state.records.filter((r) => r.empresa === comp).length;
        const active = state.selectedCompany === comp;
        const cls = active
          ? "bg-[#0B2545] text-white border-[#0B2545]"
          : "bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200";
        return `
          <button type="button" data-company-chip="${escapeHtml(comp)}" class="px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${cls}">
            ${escapeHtml(comp)} (${cnt})
          </button>
        `;
      })
      .join("");
  }

  // 3. Radar de Atención Prioritaria (Riesgo Alto + Sin Sucesor) — Sin botones de IA adicionales
  const alertsEl = document.getElementById("critical-alerts-list");
  if (alertsEl) {
    const criticalAlerts = scope.filter((r) => r.riesgo === "Alto" && !hasSuccessorRecord(r));
    if (criticalAlerts.length === 0) {
      alertsEl.innerHTML = `<div class="p-5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold">✅ No existen talentos con Riesgo Alto y sin sucesor en esta unidad.</div>`;
    } else {
      alertsEl.innerHTML = criticalAlerts
        .map(
          (r) => `
          <div class="p-4 rounded-xl bg-rose-50/50 border border-rose-200/80 flex items-center justify-between gap-3">
            <div>
              <div class="text-sm font-bold text-slate-900">${escapeHtml(r.nombre)}</div>
              <div class="text-xs text-slate-600 mt-0.5">${escapeHtml(r.posicion)} · <span class="font-semibold text-[#0B2545]">${escapeHtml(r.empresa)}</span></div>
              <div class="flex items-center gap-2 mt-2">
                <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">GGS ${r.ggs}</span>
                <span class="text-[11px] font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">9-Box ${r.nine_box}</span>
                ${r.cargo_valor === "Sí" ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">⭐ Cargo de Valor</span>` : ""}
              </div>
            </div>
            <button
              type="button"
              data-action="edit-critical"
              data-id="${r.id}"
              class="px-3 py-2 rounded-xl bg-white hover:bg-[#0B2545] text-[#0B2545] hover:text-white border border-rose-200 text-xs font-bold transition-colors shrink-0 shadow-sm"
              title="Asignar sucesor o actualizar registro"
            >
              Gestionar
            </button>
          </div>
        `
        )
        .join("");
    }
  }
}

function updateLiveCharts(scope) {
  if (!window.Chart) return;

  const fontFamily = "'Plus Jakarta Sans', 'Inter', sans-serif";

  // --------------------------------------------------------------------------
  // GRÁFICO 1: Riesgo de Pérdida vs. Cobertura de Sucesión (Barras Apiladas)
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
              backgroundColor: "#1E63E9",
              borderRadius: 6,
              barPercentage: 0.58,
            },
            {
              label: "Sin Sucesor (Brecha)",
              data: riskNoSucc,
              backgroundColor: "#E11D48",
              borderRadius: 6,
              barPercentage: 0.58,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
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
          plugins: {
            legend: {
              position: "bottom",
              labels: { font: { family: fontFamily, size: 11, weight: "600" }, boxWidth: 12, padding: 14 },
            },
            tooltip: {
              backgroundColor: "#0B2545",
              titleFont: { family: fontFamily, size: 12, weight: "700" },
              bodyFont: { family: fontFamily, size: 12 },
              padding: 10,
              cornerRadius: 8,
            },
          },
          scales: {
            x: {
              stacked: true,
              grid: { display: false },
              ticks: { font: { family: fontFamily, size: 11, weight: "700" }, color: "#334155" },
            },
            y: {
              stacked: true,
              beginAtZero: true,
              grid: { color: "#F1F5F9" },
              ticks: { precision: 0, font: { family: fontFamily, size: 11 }, color: "#64748B" },
            },
          },
        },
      });
    }
  }

  // --------------------------------------------------------------------------
  // GRÁFICO 2: Pipeline por Horizonte de Readiness (Doughnut Ejecutivo)
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
              backgroundColor: ["#10B981", "#1E63E9", "#F59E0B", "#F97316", "#E11D48"],
              borderWidth: 2,
              borderColor: "#FFFFFF",
              hoverOffset: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: {
            legend: {
              position: "bottom",
              labels: { font: { family: fontFamily, size: 11, weight: "600" }, boxWidth: 11, padding: 10 },
            },
            tooltip: {
              backgroundColor: "#0B2545",
              titleFont: { family: fontFamily, size: 12, weight: "700" },
              bodyFont: { family: fontFamily, size: 12 },
              padding: 10,
              cornerRadius: 8,
            },
          },
        },
      });
    }
  }

  // --------------------------------------------------------------------------
  // GRÁFICO 3: Nivel de Posición (N-0, N-1, N-2, N-3) y Cargos de Valor
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
              backgroundColor: "#0B2545",
              borderRadius: 6,
              barPercentage: 0.6,
            },
            {
              label: "Posición Estándar",
              data: standardByLevel,
              backgroundColor: "#94A3B8",
              borderRadius: 6,
              barPercentage: 0.6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { font: { family: fontFamily, size: 11, weight: "600" }, boxWidth: 12, padding: 14 },
            },
            tooltip: {
              backgroundColor: "#0B2545",
              titleFont: { family: fontFamily, size: 12, weight: "700" },
              bodyFont: { family: fontFamily, size: 12 },
              padding: 10,
              cornerRadius: 8,
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { family: fontFamily, size: 11, weight: "700" }, color: "#334155" },
            },
            y: {
              beginAtZero: true,
              grid: { color: "#F1F5F9" },
              ticks: { precision: 0, font: { family: fontFamily, size: 11 }, color: "#64748B" },
            },
          },
        },
      });
    }
  }

  // --------------------------------------------------------------------------
  // GRÁFICO 4: Cobertura y Riesgo por Unidad de Negocio (12 Empresas Breca)
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
              backgroundColor: "#1E63E9",
              borderRadius: 5,
            },
            {
              label: "Sin Sucesor",
              data: compNoSucc,
              backgroundColor: "#CBD5E1",
              borderRadius: 5,
            },
            {
              label: "Riesgo Alto",
              data: compHighRisk,
              backgroundColor: "#E11D48",
              borderRadius: 5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
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
          plugins: {
            legend: {
              position: "bottom",
              labels: { font: { family: fontFamily, size: 11, weight: "600" }, boxWidth: 12, padding: 16 },
            },
            tooltip: {
              backgroundColor: "#0B2545",
              titleFont: { family: fontFamily, size: 12, weight: "700" },
              bodyFont: { family: fontFamily, size: 12 },
              padding: 10,
              cornerRadius: 8,
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { family: fontFamily, size: 11, weight: "600" }, color: "#334155" },
            },
            y: {
              beginAtZero: true,
              grid: { color: "#F1F5F9" },
              ticks: { precision: 0, font: { family: fontFamily, size: 11 }, color: "#64748B" },
            },
          },
        },
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

      const riskBadge =
        r.riesgo === "Alto"
          ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80"><span class="w-1.5 h-1.5 rounded-full bg-rose-600"></span>Alto</span>`
          : r.riesgo === "Medio"
          ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Medio</span>`
          : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Bajo</span>`;

      let readinessBadge = "";
      if (!hasSuccessorRecord(r)) {
        readinessBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/70">⚠️ Sin sucesor</span>`;
      } else if (r.readiness === "Inmediato") {
        readinessBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Inmediato</span>`;
      } else if (r.readiness === "1 a 3 años") {
        readinessBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">1 a 3 años</span>`;
      } else if (r.readiness === "3 a 5 años") {
        readinessBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">3 a 5 años</span>`;
      } else {
        readinessBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-orange-50 text-orange-800 border border-orange-200">${escapeHtml(r.readiness)}</span>`;
      }

      const criticalPill =
        r.cargo_valor === "Sí"
          ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/70" title="Posición Crítica / Cargo de Valor">⭐ Crítico</span>`
          : "";

      return `
        <tr class="group">
          <td class="py-3.5 px-5">
            <div class="flex items-center gap-3.5">
              <div class="w-9 h-9 rounded-full bg-slate-100 text-[#0B2545] font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200/80">
                ${escapeHtml(getInitials(r.nombre))}
              </div>
              <div class="min-w-0">
                <button type="button" data-action="edit" data-id="${r.id}" class="font-bold text-slate-900 hover:text-blue-600 text-left block truncate transition-colors" title="Editar registro de ${escapeHtml(r.nombre)}">
                  ${escapeHtml(r.nombre)}
                </button>
                <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                    ${escapeHtml(r.empresa)}
                  </span>
                  <span class="text-[10px] font-semibold text-slate-400">DNI: ${escapeHtml(r.documento)}</span>
                  <span class="text-[11px] text-slate-400 truncate">· ${escapeHtml(r.tiempo_posicion)}</span>
                </div>
              </div>
            </div>
          </td>

          <td class="py-3.5 px-4">
            <div class="font-medium text-slate-800 leading-snug">${escapeHtml(r.posicion)}</div>
            <div class="flex items-center gap-1.5 mt-1">
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                ${escapeHtml(r.nivel)}
              </span>
              ${criticalPill}
            </div>
          </td>

          <td class="py-3.5 px-3 text-center">
            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-[#0B2545]">
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
                     <span class="font-semibold text-slate-800 leading-tight">${escapeHtml(r.sucesor)}</span>
                     <div class="flex flex-wrap items-center gap-1.5">
                       ${readinessBadge}
                       ${
                         r.motivacion_sucesor && r.motivacion_sucesor !== "-"
                           ? `<span class="text-[10px] font-semibold text-slate-500">Motivación: ${escapeHtml(r.motivacion_sucesor)}</span>`
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
                data-action="edit"
                data-id="${r.id}"
                class="p-1.5 rounded-lg text-slate-400 hover:text-[#0B2545] hover:bg-slate-100 transition-colors"
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
                class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
function setQuickActionsMode(mode) {
  state.quickActionsMode = mode === "open" ? "open" : "templates";
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
        ? "🧠 <strong>Preguntas Abiertas de Análisis y Estrategia (Gemini IA):</strong> Razonamiento sobre causas, planes de retención, vulnerabilidad y movilidad"
        : "⚡ <strong>Plantillas Ejecutivas de Reporte (Mayoría de Casos):</strong> 1 clic para generar fichas, comparativas o tablas de riesgo";
  }

  toggleQuickActions(false);
  renderQuickActions();
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
          <span class="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider ${
            isOpenMode
              ? "text-indigo-700 bg-indigo-50 border-indigo-200/80"
              : "text-blue-700 bg-blue-50 border-blue-100"
          } px-2 py-0.5 rounded-md border">
            <span>${qa.icon}</span>
            <span>${escapeHtml(qa.category)}</span>
          </span>
          <span class="text-xs text-slate-300 group-hover:text-blue-600 transition-colors font-bold">→</span>
        </div>
        <div class="text-[11.5px] font-bold text-[#0B2545] group-hover:text-blue-700 leading-snug line-clamp-2">
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
      <div class="bg-white p-3 rounded-xl border ${idx === 5 ? "border-indigo-200 bg-indigo-50/20" : "border-slate-200/80"}">
        <div class="font-extrabold ${idx === 5 ? "text-indigo-900" : "text-[#0B2545]"} text-xs mb-2">${escapeHtml(cat.category)}</div>
        <div class="grid grid-cols-1 gap-1.5">
          ${cat.items
            .map(
              (q) => `
              <button
                type="button"
                data-catalog-question="${escapeHtml(q)}"
                class="w-full text-left px-3 py-2 rounded-lg bg-slate-50/80 hover:bg-blue-600 text-slate-700 hover:text-white border border-slate-200/70 hover:border-blue-600 transition-colors text-xs font-medium"
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
 * Reinicia la sesión de conversación y muestra un saludo ejecutivo limpio
 * que explica de un vistazo la capacidad híbrida (Plantillas de Reporte + Análisis Abierto Gemini IA).
 */
function startNewChatSession() {
  state.chatHistory = [];

  const catalogPanel = document.getElementById("catalog-panel");
  if (catalogPanel) catalogPanel.classList.add("hidden");
  toggleQuickActions(false);

  const input = document.getElementById("chat-input");
  if (input) input.value = "";

  const container = document.getElementById("chat-messages-container");
  if (!container) return;

  container.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-xl bg-[#0B2545] text-white flex items-center justify-center text-xs font-extrabold shrink-0 shadow-sm">
        IA
      </div>
      <div class="bg-white rounded-2xl rounded-tl-sm px-4 py-3 border border-slate-200/90 shadow-sm max-w-[92%]">
        <p class="ai-linear-response">
          ¡Hola! 👋 ¿En qué puedo ayudarte hoy con el reporte de talento y sucesión? Puedes solicitar <strong>reportes estructurados</strong> (fichas, comparativas, alertas) o hacer <strong>preguntas abiertas de análisis y estrategia</strong>.
        </p>
      </div>
    </div>
  `;
}

function toggleQuickActions(forceState) {
  const section = document.getElementById("quick-actions-section");
  const collapseBtn = document.getElementById("btn-collapse-quick-actions");
  if (!section) return;
  state.quickActionsCollapsed =
    typeof forceState === "boolean" ? forceState : !state.quickActionsCollapsed;

  if (state.quickActionsCollapsed) {
    section.classList.add("hidden");
    if (collapseBtn) collapseBtn.textContent = "Mostrar sugerencias ▼";
  } else {
    section.classList.remove("hidden");
    if (collapseBtn) collapseBtn.textContent = "Ocultar ▲";
  }
}

function openChatDrawer() {
  const overlay = document.getElementById("chat-drawer-overlay");
  if (!overlay) return;
  overlay.classList.remove("hidden");
  // Si no hay mensajes previos en la sesión, inicializar con el saludo ejecutivo
  if (!state.chatHistory || state.chatHistory.length === 0) {
    startNewChatSession();
  }
}

function minimizeChatDrawer() {
  const overlay = document.getElementById("chat-drawer-overlay");
  if (overlay) overlay.classList.add("hidden");
  // Minimizar: conserva la conversación, el historial y las respuestas intactas para reanudarlas
}

function closeChatDrawer() {
  const overlay = document.getElementById("chat-drawer-overlay");
  if (overlay) overlay.classList.add("hidden");
  // Cerrar explícitamente: finaliza la sesión y reinicia el estado limpio
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

  // Si llegó en Markdown puro desde un modelo externo, convertirlo primero con marked
  if (!hasStructuredClass && !hasLinearClass && !cleaned.startsWith("<")) {
    cleaned = window.marked ? window.marked.parse(cleaned) : `<p class="ai-linear-response">${escapeHtml(cleaned)}</p>`;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleaned, "text/html");

  // Eliminar nodos peligrosos o prohibidos
  doc.querySelectorAll("script, iframe, object, embed, style, link, meta").forEach((el) => el.remove());

  // Limpiar atributos inline prohibidos (style= y manejadores on*)
  doc.body.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name === "style" || name.startsWith("on")) {
        el.removeAttribute(attr.name);
      }
    });
    // Si una tabla no tiene la clase ejecutiva ai-table, aplicársela
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

  // Pre-clasificar la intención con el enrutador híbrido para informar al usuario en tiempo real
  const clientIntent =
    typeof window.classifyTalentQueryIntent === "function"
      ? window.classifyTalentQueryIntent(q, state.records)
      : { route: "TEMPLATE", routeLabel: "Plantilla Ejecutiva de Reporte" };

  if (typingText) {
    typingText.textContent =
      clientIntent.route === "OPEN_ANALYSIS"
        ? "🧠 Gemini IA analizando causas, correlaciones y estrategia..."
        : "⚡ Estructurando plantilla ejecutiva de reporte...";
  }

  if (container) {
    const userDiv = document.createElement("div");
    userDiv.className = "flex justify-end";
    userDiv.innerHTML = `
      <div class="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#0B2545] text-white px-4 py-2.5 text-xs sm:text-sm font-medium shadow-sm">
        ${escapeHtml(q)}
      </div>
    `;
    container.appendChild(userDiv);
    container.scrollTop = container.scrollHeight;
  }

  if (typing) typing.classList.remove("hidden");

  let rawAnswer = "";
  let isLinear = false;
  let routeType = clientIntent.route || "TEMPLATE";
  let routeLabel = clientIntent.routeLabel || "Plantilla Ejecutiva de Reporte";
  let followUps = [];

  try {
    // 1. Evaluar con el motor híbrido en cliente sobre los datos vivos (Plantillas + Análisis Abierto IA)
    const clientResult =
      typeof window.answerTalentQuestionClient === "function"
        ? window.answerTalentQuestionClient(q, state.records)
        : null;

    if (clientResult) {
      routeType = clientResult.route || routeType;
      routeLabel = clientResult.routeLabel || routeLabel;
      followUps = Array.isArray(clientResult.followUps) ? clientResult.followUps : [];
    }

    // 2. Intentar consultar el backend local si está disponible y conectado en vivo a Gemini
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: q,
        records: state.records,
        prefer_live_api: true,
        history: state.chatHistory.slice(-6),
      }),
    });

    if (!res.ok) throw new Error("Modo estático GitHub Pages");
    const data = await res.json();

    if (data.source === "gemini_live" && (data.answer || data.reply)) {
      rawAnswer = data.answer || data.reply;
      isLinear = Boolean(data.isLinear);
      if (data.route) routeType = data.route;
      if (data.routeLabel) routeLabel = data.routeLabel;
    } else if (clientResult && clientResult.answer) {
      rawAnswer = clientResult.answer;
      isLinear = Boolean(clientResult.isLinear);
    } else {
      rawAnswer = data.answer || data.reply || "";
      isLinear = Boolean(data.isLinear);
    }
  } catch (_err) {
    if (typeof window.answerTalentQuestionClient === "function") {
      const clientRes = window.answerTalentQuestionClient(q, state.records);
      rawAnswer = clientRes.answer || "";
      isLinear = Boolean(clientRes.isLinear);
      routeType = clientRes.route || routeType;
      routeLabel = clientRes.routeLabel || routeLabel;
      followUps = Array.isArray(clientRes.followUps) ? clientRes.followUps : [];
    } else {
      rawAnswer = '<p class="ai-linear-response">No se pudo procesar la consulta en este momento.</p>';
      isLinear = true;
    }
  } finally {
    if (typing) typing.classList.add("hidden");
  }

  const validated = validateAndSanitizeAgentHtml(rawAnswer, isLinear);

  state.chatHistory.push({ role: "user", content: q });
  state.chatHistory.push({ role: "assistant", content: validated.html });

  if (container) {
    const botDiv = document.createElement("div");
    if (validated.isLinear) {
      // Respuesta lineal/conversacional breve: burbuja limpia sin tarjeta compleja
      botDiv.className = "flex items-start gap-3";
      botDiv.innerHTML = `
        <div class="w-8 h-8 rounded-xl bg-[#0B2545] text-white flex items-center justify-center text-xs font-extrabold shrink-0 shadow-sm">
          IA
        </div>
        <div class="bg-white rounded-2xl rounded-tl-sm px-4 py-3 border border-slate-200/90 shadow-sm max-w-[90%]">
          ${validated.html}
        </div>
      `;
    } else {
      const isOpenRoute = routeType === "OPEN_ANALYSIS";
      const badgeClass = isOpenRoute ? "ai-route-badge-open" : "ai-route-badge-template";
      const badgeIcon = isOpenRoute ? "🧠" : "⚡";

      const followUpHtml =
        followUps.length > 0
          ? `<div class="ai-followup-bar px-1">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Profundizar:</span>
              ${followUps
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

      botDiv.className = "space-y-1.5";
      botDiv.innerHTML = `
        <div class="flex items-center justify-between gap-2 px-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="${badgeClass}">
              <span>${badgeIcon}</span>
              <span>${escapeHtml(routeLabel)}</span>
            </span>
          </div>
          <button type="button" data-expand-quick="true" class="text-[11px] font-bold text-blue-600 hover:underline whitespace-nowrap">
            Mostrar sugerencias ▼
          </button>
        </div>
        ${validated.html}
        ${followUpHtml}
      `;
    }
    container.appendChild(botDiv);
    container.scrollTop = container.scrollHeight;
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
  try {
    await fetch("/api/talents/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records: state.records }),
    });
  } catch (_err) {
    // En modo estático (GitHub Pages) se mantiene en memoria local
  }
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
  const colorClass =
    type === "error"
      ? "bg-rose-600 text-white"
      : type === "success"
      ? "bg-[#0B2545] text-white border border-blue-400/30"
      : "bg-slate-800 text-white";

  toast.className = `pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold ${colorClass} transition-opacity duration-300`;
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

  // Delegación de eventos en Tabla (Edición y Eliminación)
  document.getElementById("talent-table-body")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    const rec = state.records.find((r) => String(r.id) === String(id));
    if (!rec) return;

    if (action === "edit") {
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
    const btn = e.target.closest("button[data-action='edit-critical']");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const rec = state.records.find((r) => String(r.id) === String(id));
    if (rec) openTalentModal(rec);
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
  document.getElementById("btn-reload-source")?.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/reload", { method: "POST" });
      if (!res.ok) throw new Error("Modo estático");
      const data = await res.json();
      state.records = normalizeClientRecords(data.records || []);
    } catch (_err) {
      const fallbackData = Array.isArray(window.CENTRIA_INITIAL_DATA) ? window.CENTRIA_INITIAL_DATA : [];
      state.records = normalizeClientRecords(fallbackData);
    }
    refreshMetadataLists();
    clearAllFilters();
    showToast("Restaurados los 101 registros originales del reporte", "success");
  });

  document.getElementById("btn-new-talent")?.addEventListener("click", () => openTalentModal(null));
  document.getElementById("btn-close-talent-modal")?.addEventListener("click", closeTalentModal);
  document.getElementById("btn-cancel-talent-modal")?.addEventListener("click", closeTalentModal);
  document.getElementById("talent-modal-backdrop")?.addEventListener("click", closeTalentModal);
  document.getElementById("talent-crud-form")?.addEventListener("submit", saveTalentFromModal);

  // Agente IA: FAB abre/reanuda, Minimizar o clic fuera preserva, Cerrar/Nueva sesión reinicia
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

  document.getElementById("btn-expand-drawer")?.addEventListener("click", () => {
    const panel = document.getElementById("chat-drawer-panel");
    if (!panel) return;
    state.drawerExpanded = !state.drawerExpanded;
    if (state.drawerExpanded) {
      panel.classList.remove("sm:w-[640px]", "lg:w-[720px]");
      panel.classList.add("sm:w-[820px]", "lg:w-[960px]");
    } else {
      panel.classList.remove("sm:w-[820px]", "lg:w-[960px]");
      panel.classList.add("sm:w-[640px]", "lg:w-[720px]");
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
