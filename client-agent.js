/**
 * ============================================================================
 * Centria Talent & Succession Intelligence — Client-Side AI HTML Engine
 * ============================================================================
 * Motor analítico y semántico en memoria (RAG client-side) para funcionamiento
 * 100% autónomo en GitHub Pages (página estática) y respaldo instantáneo local.
 *
 * REGLA DE FORMATO DE RESPUESTA:
 * - Consultas Estructuradas (Fichas, Comparaciones, Riesgos/Brechas, Empresas,
 *   Informes de Comité): devuelve una estructura HTML visual y ordenada
 *   (`<div class="ai-structured-response">...</div>`) sin atributos `style=`.
 * - Consultas Lineales / Conversacionales (Saludos, agradecimientos, preguntas
 *   puntuales de un solo dato o conversación lineal): devuelve una respuesta
 *   lineal limpia (`<p class="ai-linear-response">...</p>`) con `isLinear: true`.
 */

(function () {
  function norm(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function hasSuccessor(r) {
    if (typeof r.tiene_sucesor_bool === "boolean") return r.tiene_sucesor_bool;
    const s = norm(r.sucesor);
    return s !== "" && s !== "sin sucesor" && s !== "-" && s !== "sin cobertura" && s !== "no";
  }

  function riskBadgeHtml(riesgo) {
    if (riesgo === "Alto") return `<span class="ai-badge ai-badge-red">🔴 Alto</span>`;
    if (riesgo === "Medio") return `<span class="ai-badge ai-badge-amber">🟡 Medio</span>`;
    return `<span class="ai-badge ai-badge-green">🟢 Bajo</span>`;
  }

  function readinessBadgeHtml(r) {
    if (!hasSuccessor(r)) {
      return `<span class="ai-badge ai-badge-red">⚠️ Sin sucesor</span>`;
    }
    if (r.readiness === "Inmediato") {
      return `<span class="ai-badge ai-badge-green">🟢 Inmediato</span>`;
    }
    if (r.readiness === "1 a 3 años") {
      return `<span class="ai-badge ai-badge-blue">🔵 1 a 3 años</span>`;
    }
    if (r.readiness === "3 a 5 años") {
      return `<span class="ai-badge ai-badge-amber">🟡 3 a 5 años</span>`;
    }
    return `<span class="ai-badge ai-badge-amber">🟠 ${esc(r.readiness)}</span>`;
  }

  function nineBoxDesc(box) {
    const map = {
      9: "Estrella / Top Talent",
      8: "Alto Potencial",
      7: "Enigma / Alto Potencial",
      6: "Futuro Líder",
      5: "Talento Clave (Core)",
      4: "Profesional Confiable",
      3: "Especialista Efectivo",
      2: "En Observación",
      1: "Bajo Desempeño",
    };
    return map[Number(box)] || "Evaluado";
  }

  function findMentionedTalents(qNorm, records) {
    const found = [];
    const seen = new Set();

    for (const r of records) {
      const fullNorm = norm(r.nombre);
      if (fullNorm && qNorm.includes(fullNorm) && !seen.has(r.id)) {
        found.push(r);
        seen.add(r.id);
      }
    }

    if (found.length < 2) {
      for (const r of records) {
        if (seen.has(r.id)) continue;
        const parts = norm(r.nombre).split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          const first = parts[0];
          const last = parts[1];
          if (first.length >= 3 && last.length >= 4 && qNorm.includes(first) && qNorm.includes(last)) {
            found.push(r);
            seen.add(r.id);
          }
        }
      }
    }

    return found;
  }

  function findMentionedSuccessors(qNorm, records) {
    const matches = [];
    for (const r of records) {
      if (!hasSuccessor(r)) continue;
      const sucNorm = norm(r.sucesor);
      if (sucNorm && qNorm.includes(sucNorm)) {
        matches.push(r);
      }
    }
    return matches;
  }

  function findMentionedCompanies(qNorm, records) {
    const companies = Array.from(new Set(records.map((r) => r.empresa).filter(Boolean)));
    const matched = [];
    for (const c of companies) {
      const cNorm = norm(c);
      if (qNorm.includes(cNorm)) {
        matched.push(c);
      } else if (cNorm === "corporacion breca" && /\bbreca\b/.test(qNorm) && !qNorm.includes("grupo breca")) {
        matched.push(c);
      } else if (cNorm === "clinica internacional" && /\bclinica\b/.test(qNorm)) {
        matched.push(c);
      }
    }
    return matched;
  }

  function parseTenureMonths(tenureStr) {
    const s = norm(tenureStr);
    if (!s) return 0;
    const yrMatch = s.match(/(\d+)\s*ano/);
    const moMatch = s.match(/(\d+)\s*mes/);
    const years = yrMatch ? parseInt(yrMatch[1], 10) : 0;
    const months = moMatch ? parseInt(moMatch[1], 10) : 0;
    return years * 12 + months;
  }

  // ==========================================================================
  // ENRUTADOR INTELIGENTE DE INTENCIÓN (PLANTILLA DE REPORTE vs ANÁLISIS ABIERTO IA)
  // ==========================================================================
  const OPEN_ANALYSIS_TRIGGERS = [
    "por que",
    "porque",
    "causas",
    "causa",
    "cual es la causa",
    "que explica",
    "que recomiendas",
    "que sugieres",
    "que propones",
    "que deberiamos",
    "como podemos",
    "como retener",
    "plan de retencion",
    "plan de accion",
    "plan de contingencia",
    "estrategia",
    "hoja de ruta",
    "roadmap",
    "como mitigar",
    "como resolver",
    "como cerrar",
    "como cubrir",
    "como acelerar",
    "analiza a fondo",
    "analisis profundo",
    "diagnostico profundo",
    "diagnostico integral",
    "que opinas",
    "evalua",
    "impacto",
    "como impacta",
    "correlacion",
    "relacion entre",
    "quien podria reemplazar",
    "quien puede suceder",
    "quien podria suceder",
    "candidatos internos",
    "otras empresas",
    "movilidad",
    "transversal",
    "banca de sucesion",
    "mas vulnerable",
    "mayor vulnerabilidad",
    "empresas mas vulnerables",
    "mayor exposicion",
    "riesgo oculto",
    "fuga silenciosa",
    "estancamiento",
    "rotacion",
    "motivacion",
    "tiempo en la posicion",
    "tiempo en el puesto",
    "tiempo en el rol",
    "antiguedad",
    "cuello de botella",
    "bloqueo de promocion",
    "bloqueo",
    "priorizar",
    "donde enfocar",
    "que riesgos ves",
    "que oportunidades",
  ];

  function isOpenAnalyticalQuestion(qNorm) {
    return OPEN_ANALYSIS_TRIGGERS.some((kw) => qNorm.includes(kw));
  }

  function buildOpenAnalysisHtml(question, qNorm, allRecords, mentionedTalents, mentionedCompanies) {
    const total = allRecords.length || 1;
    const readyNowPool = allRecords.filter((r) => hasSuccessor(r) && r.readiness === "Inmediato");
    const topTalentsPool = allRecords.filter((r) => r.nine_box >= 8);

    // ------------------------------------------------------------------------
    // CASO ABIERTO A: Plan de Retención / Aceleración / Reemplazo para un Talento
    // ------------------------------------------------------------------------
    if (mentionedTalents.length === 1) {
      const t = mentionedTalents[0];
      const hasSuc = hasSuccessor(t);
      const tenureMo = parseTenureMonths(t.tiempo_posicion);
      // Buscar candidatos puente o pares de alto potencial en el Grupo Breca del mismo Nivel o GGS cercano
      const internalBench = allRecords
        .filter(
          (r) =>
            r.id !== t.id &&
            r.nine_box >= 8 &&
            r.riesgo !== "Alto" &&
            (r.nivel === t.nivel || Math.abs(r.ggs - t.ggs) <= 1)
        )
        .slice(0, 4);

      const benchRows = internalBench
        .map(
          (b) => `
          <tr>
            <td><strong>${esc(b.nombre)}</strong></td>
            <td>${esc(b.empresa)}</td>
            <td>${esc(b.posicion)} (${esc(b.nivel)})</td>
            <td><span class="ai-badge ai-badge-navy">GGS ${b.ggs}</span></td>
            <td><span class="ai-badge ai-badge-indigo">9-Box ${b.nine_box}</span></td>
            <td>${riskBadgeHtml(b.riesgo)}</td>
            <td>${hasSuccessor(b) ? esc(b.sucesor) + " (" + esc(b.readiness) + ")" : "Sin sucesor"}</td>
          </tr>
        `
        )
        .join("");

      const urgencyLevel =
        t.riesgo === "Alto" && (!hasSuc || t.readiness === "3 a 5 años" || t.readiness === "+ de 5 años")
          ? "CRÍTICA (Intervención Inmediata)"
          : t.riesgo === "Alto"
          ? "ALTA (Retención Prioritaria)"
          : "MODERADA (Consolidación y Desarrollo)";

      return {
        subType: "talent_advisory",
        followUps: [
          `Genera la ficha ejecutiva de ${t.nombre}.`,
          `¿Qué talentos de ${t.empresa} tienen 9Box 8 o 9?`,
          "¿Cómo cubrir las posiciones críticas sin sucesor con movilidad inter-empresas?",
        ],
        html: `
          <div class="ai-structured-response">
            <div class="ai-html-card">
              <div class="ai-html-header-open">
                <div>
                  <h4 class="ai-html-title">🧠 Estrategia de Retención y Sucesión: ${esc(t.nombre)}</h4>
                  <div class="ai-html-subtitle">${esc(t.posicion)} · ${esc(t.empresa)} · Nivel ${esc(t.nivel)} (GGS ${t.ggs})</div>
                </div>
                <span class="ai-badge ai-badge-indigo">Prioridad: ${urgencyLevel}</span>
              </div>
              <div class="ai-html-body">
                <div class="ai-insight-banner">
                  <strong>Diagnóstico Multifactorial Gemini IA:</strong> <strong>${esc(t.nombre)}</strong> ocupa una posición <strong>${t.cargo_valor === "Sí" ? "Crítica (Cargo de Valor)" : "Ejecutiva"}</strong> con calificación <strong>9-Box ${t.nine_box} (${nineBoxDesc(t.nine_box)})</strong>, una permanencia de <strong>${esc(t.tiempo_posicion)}</strong> (${tenureMo} meses) en el puesto y <strong>Riesgo de Pérdida ${esc(t.riesgo)}</strong>. ${
                    hasSuc
                      ? `Su sucesor designado es <strong>${esc(t.sucesor)}</strong> con horizonte <strong>${esc(t.readiness)}</strong> y motivación <em>"${esc(t.motivacion_sucesor)}"</em>.`
                      : `Actualmente <strong>NO cuenta con sucesor identificado</strong>, lo que genera exposición operativa directa en <strong>${esc(t.empresa)}</strong>.`
                  }
                </div>

                <div class="ai-section-title">🎯 Plan de Acción Recomendado (Horizonte 30 - 90 Días)</div>
                <div class="ai-step-grid">
                  <div class="ai-step-card">
                    <div class="ai-step-card-title">1. Blindaje y Retención</div>
                    <div class="ai-step-card-text">
                      ${
                        t.riesgo === "Alto"
                          ? `Ejecutar entrevista de permanencia (Stay Interview) con VP de Talento y sponsor de ${esc(t.empresa)}. Con ${esc(t.tiempo_posicion)} en el rol y 9-Box ${t.nine_box}, requiere nuevo reto estratégico o proyecto transversal en el Grupo Breca.`
                          : `Mantener esquema de reconocimiento y visibilidad en comités corporativos, aprovechando su solidez en 9-Box ${t.nine_box}.`
                      }
                    </div>
                  </div>
                  <div class="ai-step-card">
                    <div class="ai-step-card-title">2. Aceleración del Sucesor</div>
                    <div class="ai-step-card-text">
                      ${
                        hasSuc
                          ? `Comprimir la curva de preparación de <strong>${esc(t.sucesor)}</strong> (actualmente en <em>${esc(t.readiness)}</em>) mediante co-liderazgo de iniciativas críticas y exposición trimestral al Comité.`
                          : `Definir en los próximos 30 días una terna nominal de sucesión evaluando líderes N-2/N-3 con 9-Box 7-9 dentro de ${esc(t.empresa)} y unidades afines.`
                      }
                    </div>
                  </div>
                  <div class="ai-step-card">
                    <div class="ai-step-card-title">3. Cobertura Puente (Back-up)</div>
                    <div class="ai-step-card-text">
                      Activar movilidad inter-empresas del Grupo Breca para contar con un reemplazo de contingencia (Ready Now / Alto Potencial) en caso de transición anticipada.
                    </div>
                  </div>
                </div>

                <div class="ai-section-title">🔄 Banca Transversal Sugerida en Grupo Breca (Pares ${esc(t.nivel)} / GGS Cercano con 9-Box 8–9)</div>
                <div class="ai-table-wrap">
                  <table class="ai-table">
                    <thead>
                      <tr>
                        <th>Candidato / Par Potencial</th>
                        <th>Empresa Actual</th>
                        <th>Posición / Nivel</th>
                        <th>GGS</th>
                        <th>9-Box</th>
                        <th>Riesgo</th>
                        <th>Back-up en su Rol</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${benchRows || `<tr><td colspan="7">No se encontraron pares adicionales en el mismo tramo GGS.</td></tr>`}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        `,
      };
    }

    // ------------------------------------------------------------------------
    // CASO ABIERTO B: Análisis de Motivación de Sucesores (Columna P cruzada con Riesgo/Readiness)
    // ------------------------------------------------------------------------
    if (qNorm.includes("motivacion") || qNorm.includes("interes del sucesor") || qNorm.includes("compromiso")) {
      const withSucList = allRecords.filter((r) => hasSuccessor(r));
      const motStats = {};
      withSucList.forEach((r) => {
        const m = r.motivacion_sucesor || "Sin especificar";
        if (!motStats[m]) {
          motStats[m] = { count: 0, highRiskHolders: 0, criticalRoles: 0, examples: [] };
        }
        motStats[m].count += 1;
        if (r.riesgo === "Alto") motStats[m].highRiskHolders += 1;
        if (r.cargo_valor === "Sí") motStats[m].criticalRoles += 1;
        if (motStats[m].examples.length < 2) {
          motStats[m].examples.push(`${r.sucesor} (sucesor de ${r.nombre} en ${r.empresa})`);
        }
      });

      const lowOrMedSuc = withSucList.filter(
        (r) =>
          norm(r.motivacion_sucesor).includes("baja") ||
          norm(r.motivacion_sucesor).includes("media")
      );

      const motRows = Object.entries(motStats)
        .sort((a, b) => b[1].count - a[1].count)
        .map(
          ([mot, st]) => `
          <tr>
            <td><strong>${esc(mot)}</strong></td>
            <td><strong>${st.count}</strong> (${((st.count / Math.max(1, withSucList.length)) * 100).toFixed(1)}%)</td>
            <td><span class="ai-badge ${st.highRiskHolders > 0 ? "ai-badge-red" : "ai-badge-green"}">${st.highRiskHolders} titulares en riesgo alto</span></td>
            <td>${st.criticalRoles} cargos de valor</td>
            <td>${esc(st.examples.join(" · "))}</td>
          </tr>
        `
        )
        .join("");

      const alertRows = lowOrMedSuc
        .slice(0, 8)
        .map(
          (r) => `
          <tr>
            <td><strong>${esc(r.empresa)}</strong></td>
            <td>${esc(r.nombre)} (${riskBadgeHtml(r.riesgo)})</td>
            <td>${esc(r.posicion)}</td>
            <td><strong>${esc(r.sucesor)}</strong></td>
            <td>${readinessBadgeHtml(r)}</td>
            <td><span class="ai-badge ${norm(r.motivacion_sucesor).includes("baja") ? "ai-badge-red" : "ai-badge-amber"}">${esc(r.motivacion_sucesor)}</span></td>
          </tr>
        `
        )
        .join("");

      return {
        subType: "motivation_analysis",
        followUps: [
          "¿Qué talentos tienen riesgo alto y un sucesor preparado en más de tres años?",
          "¿Cómo cubrir las brechas de sucesión con talento de otras empresas del grupo?",
          "¿Cuáles son las empresas más vulnerables del grupo y por qué?",
        ],
        html: `
          <div class="ai-structured-response">
            <div class="ai-html-card">
              <div class="ai-html-header-open">
                <div>
                  <h4 class="ai-html-title">🧠 Análisis de Motivación de Sucesores y Riesgo de Transición</h4>
                  <div class="ai-html-subtitle">Cruce de la columna "Motivación del sucesor" sobre las ${withSucList.length} posiciones con sucesor asignado</div>
                </div>
                <span class="ai-badge ai-badge-indigo">${withSucList.length} Sucesores Evaluados</span>
              </div>
              <div class="ai-html-body">
                <div class="ai-insight-banner">
                  <strong>Hallazgo Clave de Consultoría IA:</strong> Contar con un sucesor nominal no garantiza una transición exitosa si su motivación es baja o condicionada. En el pool actual de <strong>${withSucList.length} sucesores</strong>, se detectan <strong>${lowOrMedSuc.length} casos con motivación Media o Baja</strong> (ej. priorizan estabilidad en su rol actual o están sujetos a ubicación geográfica), lo que representa un <strong>riesgo de sucesión fallida</strong> si el titular se retira.
                </div>

                <div class="ai-section-title">📊 Distribución por Perfil de Motivación del Sucesor</div>
                <div class="ai-table-wrap">
                  <table class="ai-table">
                    <thead>
                      <tr>
                        <th>Motivación del Sucesor (Columna P)</th>
                        <th>Sucesores</th>
                        <th>Titulares en Riesgo Alto</th>
                        <th>En Cargos de Valor</th>
                        <th>Casos Representativos</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${motRows}
                    </tbody>
                  </table>
                </div>

                <div class="ai-section-title">⚠️ Casos de Atención: Sucesores con Motivación Baja o Media (${lowOrMedSuc.length} detectados)</div>
                <div class="ai-table-wrap">
                  <table class="ai-table">
                    <thead>
                      <tr>
                        <th>Empresa</th>
                        <th>Titular Actual</th>
                        <th>Posición</th>
                        <th>Sucesor Nominal</th>
                        <th>Readiness</th>
                        <th>Motivación Registrada</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${alertRows}
                    </tbody>
                  </table>
                </div>

                <div class="ai-alert-box ai-alert-info">
                  <strong>Recomendación Ejecutiva:</strong> Validar en sesiones de calibración 1-a-1 la disposición real de los <strong>${lowOrMedSuc.length} sucesores con motivación media/baja</strong> y aprovechar a los sucesores con <em>"Alta - Interés en movilidad interempresa"</em> para cubrir vacantes críticas en otras unidades del Grupo Breca.
                </div>
              </div>
            </div>
          </div>
        `,
      };
    }

    // ------------------------------------------------------------------------
    // CASO ABIERTO C: Antigüedad / Tiempo en la Posición vs. Estancamiento y Fuga
    // ------------------------------------------------------------------------
    if (
      qNorm.includes("tiempo en la posicion") ||
      qNorm.includes("tiempo en el rol") ||
      qNorm.includes("antiguedad") ||
      qNorm.includes("estancamiento") ||
      qNorm.includes("permanencia")
    ) {
      const enriched = allRecords.map((r) => ({
        ...r,
        months: parseTenureMonths(r.tiempo_posicion),
      }));

      const highTenureHighRisk = enriched
        .filter((r) => r.months >= 48 && r.riesgo === "Alto")
        .sort((a, b) => b.months - a.months);

      const highTenureTopTalent = enriched
        .filter((r) => r.months >= 48 && r.nine_box >= 8)
        .sort((a, b) => b.months - a.months);

      const newInRoleNoSuc = enriched
        .filter((r) => r.months > 0 && r.months <= 18 && !hasSuccessor(r))
        .sort((a, b) => a.months - b.months);

      const tenureRows = highTenureHighRisk
        .slice(0, 8)
        .map(
          (r) => `
          <tr>
            <td><strong>${esc(r.nombre)}</strong></td>
            <td>${esc(r.empresa)}</td>
            <td>${esc(r.posicion)} (${esc(r.nivel)})</td>
            <td><span class="ai-badge ai-badge-navy">${esc(r.tiempo_posicion)}</span></td>
            <td><span class="ai-badge ai-badge-indigo">9-Box ${r.nine_box}</span></td>
            <td>${riskBadgeHtml(r.riesgo)}</td>
            <td>${hasSuccessor(r) ? esc(r.sucesor) + " (" + esc(r.readiness) + ")" : '<span class="ai-badge ai-badge-red">Sin sucesor</span>'}</td>
          </tr>
        `
        )
        .join("");

      return {
        subType: "tenure_analysis",
        followUps: [
          "¿Qué talentos tienen 9Box 8 o 9 y no cuentan con sucesor?",
          "¿Qué recomiendas para retener a los talentos clave con riesgo alto?",
          "¿Cuáles son las empresas más vulnerables del grupo y por qué?",
        ],
        html: `
          <div class="ai-structured-response">
            <div class="ai-html-card">
              <div class="ai-html-header-open">
                <div>
                  <h4 class="ai-html-title">🧠 Análisis de Permanencia en el Rol, Estancamiento y Riesgo de Fuga</h4>
                  <div class="ai-html-subtitle">Cruce de "Tiempo en la posición actual" (Columna K) vs. Riesgo de Pérdida y 9-Box</div>
                </div>
                <span class="ai-badge ai-badge-indigo">${allRecords.length} Posiciones Analizadas</span>
              </div>
              <div class="ai-html-body">
                <div class="ai-kpi-grid">
                  <div class="ai-kpi-box">
                    <span class="ai-kpi-label">≥ 4 Años + Riesgo Alto</span>
                    <div class="ai-kpi-value">${highTenureHighRisk.length} ejecutivos</div>
                  </div>
                  <div class="ai-kpi-box">
                    <span class="ai-kpi-label">≥ 4 Años + Top Talent (8-9)</span>
                    <div class="ai-kpi-value">${highTenureTopTalent.length} líderes</div>
                  </div>
                  <div class="ai-kpi-box">
                    <span class="ai-kpi-label">≤ 18 Meses + Sin Sucesor</span>
                    <div class="ai-kpi-value">${newInRoleNoSuc.length} posiciones</div>
                  </div>
                </div>

                <div class="ai-insight-banner">
                  <strong>Patrón Detectado por IA:</strong> Se identifican <strong>${highTenureHighRisk.length} ejecutivos con más de 4 años en la misma posición y Riesgo de Pérdida Alto</strong>. Cuando un líder de alto desempeño supera los 48 meses sin rotación ni promoción (frecuentemente bloqueado porque su sucesor aún está a 3–5 años o no tiene sucesor), la probabilidad de rotación voluntaria hacia el mercado se dispara.
                </div>

                <div class="ai-section-title">🚨 Ejecutivos con Alta Permanencia (≥ 4 años) y Riesgo de Pérdida Alto</div>
                <div class="ai-table-wrap">
                  <table class="ai-table">
                    <thead>
                      <tr>
                        <th>Talento</th>
                        <th>Empresa</th>
                        <th>Posición / Nivel</th>
                        <th>Tiempo en el Rol</th>
                        <th>9-Box</th>
                        <th>Riesgo</th>
                        <th>Sucesor / Readiness</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${tenureRows}
                    </tbody>
                  </table>
                </div>

                <div class="ai-alert-box ai-alert-info">
                  <strong>Acción Sugerida:</strong> Priorizar la rotación horizontal o asignación de proyectos corporativos Breca para los <strong>${highTenureTopTalent.length} Top Talents (9-Box 8–9) con más de 4 años en su puesto</strong>, acelerando en paralelo a sus sucesores para desbloquear su movilidad.
                </div>
              </div>
            </div>
          </div>
        `,
      };
    }

    // ------------------------------------------------------------------------
    // CASO ABIERTO D: Ranking de Vulnerabilidad por Empresa (¿Cuáles son las empresas más vulnerables?)
    // ------------------------------------------------------------------------
    if (
      qNorm.includes("vulnerable") ||
      qNorm.includes("vulnerabilidad") ||
      qNorm.includes("exposicion") ||
      (qNorm.includes("empresa") && (qNorm.includes("critica") || qNorm.includes("riesgo") || qNorm.includes("peor") || qNorm.includes("priorizar")))
    ) {
      const companies = Array.from(new Set(allRecords.map((r) => r.empresa).filter(Boolean)));
      const compMetrics = companies
        .map((c) => {
          const rows = allRecords.filter((r) => r.empresa === c);
          const n = rows.length || 1;
          const noSuc = rows.filter((r) => !hasSuccessor(r)).length;
          const highRisk = rows.filter((r) => r.riesgo === "Alto").length;
          const critTwin = rows.filter((r) => r.riesgo === "Alto" && !hasSuccessor(r)).length;
          const cvNoSuc = rows.filter((r) => r.cargo_valor === "Sí" && !hasSuccessor(r)).length;
          const ready = rows.filter((r) => hasSuccessor(r) && r.readiness === "Inmediato").length;
          // Índice de Vulnerabilidad Sucesoria (IVS) ponderado
          const ivsScore = Math.round(((critTwin * 3.5 + noSuc * 1.8 + highRisk * 1.4 + cvNoSuc * 2.0) / n) * 20);
          return {
            company: c,
            total: rows.length,
            noSuc,
            covPct: (((rows.length - noSuc) / n) * 100).toFixed(0),
            highRisk,
            critTwin,
            cvNoSuc,
            ready,
            ivsScore,
          };
        })
        .sort((a, b) => b.ivsScore - a.ivsScore || b.critTwin - a.critTwin);

      const compRows = compMetrics
        .map(
          (m, idx) => `
          <tr>
            <td><strong>#${idx + 1}</strong></td>
            <td><strong>${esc(m.company)}</strong></td>
            <td>${m.total}</td>
            <td><span class="ai-badge ${Number(m.covPct) < 75 ? "ai-badge-red" : Number(m.covPct) < 82 ? "ai-badge-amber" : "ai-badge-green"}">${m.covPct}%</span></td>
            <td>${m.highRisk}</td>
            <td><span class="ai-badge ${m.critTwin > 0 ? "ai-badge-red" : "ai-badge-green"}">${m.critTwin} casos</span></td>
            <td>${m.cvNoSuc}</td>
            <td><strong>${m.ivsScore} pts</strong></td>
          </tr>
        `
        )
        .join("");

      const top3 = compMetrics.slice(0, 3);

      return {
        subType: "company_vulnerability",
        followUps: [
          `Genera un resumen de los talentos registrados en ${top3[0]?.company || "Centria"}.`,
          "¿Cómo cubrir las brechas de sucesión con movilidad entre empresas del grupo?",
          "¿Qué talentos tienen riesgo alto de pérdida y no cuentan con sucesor?",
        ],
        html: `
          <div class="ai-structured-response">
            <div class="ai-html-card">
              <div class="ai-html-header-open">
                <div>
                  <h4 class="ai-html-title">🧠 Índice de Vulnerabilidad de Talento y Sucesión por Unidad de Negocio</h4>
                  <div class="ai-html-subtitle">Evaluación multicriterio (Riesgo Alto sin Sucesor, Brecha en Cargos de Valor y Cobertura Nominal)</div>
                </div>
                <span class="ai-badge ai-badge-indigo">12 Empresas Evaluadas</span>
              </div>
              <div class="ai-html-body">
                <div class="ai-insight-banner">
                  <strong>Diagnóstico Comparativo IA:</strong> Las 3 unidades con mayor exposición combinada son <strong>${esc(top3[0]?.company)}</strong> (IVS ${top3[0]?.ivsScore} pts, ${top3[0]?.critTwin} casos de riesgo alto sin sucesor), <strong>${esc(top3[1]?.company)}</strong> (IVS ${top3[1]?.ivsScore} pts) y <strong>${esc(top3[2]?.company)}</strong> (IVS ${top3[2]?.ivsScore} pts). La vulnerabilidad no depende solo del porcentaje de cobertura, sino de la concentración de <strong>Riesgo Alto sin back-up en Cargos de Valor</strong>.
                </div>

                <div class="ai-section-title">📊 Ranking Corporativo de Exposición y Vulnerabilidad Sucesoria</div>
                <div class="ai-table-wrap">
                  <table class="ai-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Empresa</th>
                        <th>Posiciones</th>
                        <th>Cobertura</th>
                        <th>Riesgo Alto</th>
                        <th>Riesgo Alto + Sin Sucesor</th>
                        <th>Cargos Valor Sin Sucesor</th>
                        <th>Índice IVS</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${compRows}
                    </tbody>
                  </table>
                </div>

                <div class="ai-alert-box ai-alert-critical">
                  <strong>Foco de Intervención Inmediata:</strong> Priorizar comités extraordinarios de sucesión en <strong>${esc(top3.map((x) => x.company).join(", "))}</strong>, apalancando el pool de sucesores <em>Ready Now</em> de unidades con mayor madurez de cobertura.
                </div>
              </div>
            </div>
          </div>
        `,
      };
    }

    // ------------------------------------------------------------------------
    // CASO ABIERTO E: Movilidad Inter-Empresas y Cierre de Brechas con Banca Interna
    // ------------------------------------------------------------------------
    if (
      qNorm.includes("movilidad") ||
      qNorm.includes("otras empresas") ||
      qNorm.includes("transversal") ||
      qNorm.includes("cubrir") ||
      qNorm.includes("quien podria reemplazar") ||
      qNorm.includes("banca")
    ) {
      const criticalGaps = allRecords.filter((r) => !hasSuccessor(r) && (r.riesgo === "Alto" || r.cargo_valor === "Sí"));
      const mobileSuccessors = allRecords.filter(
        (r) =>
          hasSuccessor(r) &&
          (r.readiness === "Inmediato" || norm(r.motivacion_sucesor).includes("interempresa") || norm(r.motivacion_sucesor).includes("grupo") || norm(r.motivacion_sucesor).includes("regional"))
      );

      // Emparejar cada brecha crítica con un candidato del grupo del mismo Nivel/GGS cercano
      const matchRows = criticalGaps
        .slice(0, 9)
        .map((gap) => {
          const candidate =
            mobileSuccessors.find(
              (m) => m.empresa !== gap.empresa && (m.nivel === gap.nivel || Math.abs(m.ggs - gap.ggs) <= 1)
            ) ||
            readyNowPool.find((m) => m.empresa !== gap.empresa) ||
            topTalentsPool.find((m) => m.empresa !== gap.empresa && m.riesgo === "Bajo");

          return `
            <tr>
              <td><strong>${esc(gap.empresa)}</strong></td>
              <td><strong>${esc(gap.nombre)}</strong><br/><span class="ai-badge ai-badge-red">Riesgo ${esc(gap.riesgo)} · Sin sucesor</span></td>
              <td>${esc(gap.posicion)} (${esc(gap.nivel)} · GGS ${gap.ggs})</td>
              <td>${
                candidate
                  ? `<strong>${esc(candidate.sucesor !== "Sin sucesor" ? candidate.sucesor : candidate.nombre)}</strong> (${esc(candidate.empresa)})`
                  : "Por mapear en comité"
              }</td>
              <td>${
                candidate
                  ? `<span class="ai-badge ai-badge-green">${esc(candidate.readiness !== "Sin cobertura" ? candidate.readiness : "Top Talent 9-Box " + candidate.nine_box)}</span>`
                  : "-"
              }</td>
            </tr>
          `;
        })
        .join("");

      return {
        subType: "intercompany_mobility",
        followUps: [
          "¿Qué talentos tienen un sucesor con readiness inmediato?",
          "¿Cómo impacta la motivación de los sucesores en el riesgo de transición?",
          "¿Qué cargos de valor no cuentan con sucesor?",
        ],
        html: `
          <div class="ai-structured-response">
            <div class="ai-html-card">
              <div class="ai-html-header-open">
                <div>
                  <h4 class="ai-html-title">🧠 Matriz de Movilidad Transversal Breca (Cierre de Brechas Críticas)</h4>
                  <div class="ai-html-subtitle">Cruce inteligente entre vacantes sucesorias críticas y talentos Ready Now / Movilidad Interempresa</div>
                </div>
                <span class="ai-badge ai-badge-indigo">${mobileSuccessors.length} Candidatos Movilizables</span>
              </div>
              <div class="ai-html-body">
                <div class="ai-insight-banner">
                  <strong>Estrategia Corporativa Grupo Breca:</strong> Mientras existen <strong>${criticalGaps.length} posiciones de alta criticidad sin sucesor</strong> en unidades específicas, el Grupo cuenta con <strong>${readyNowPool.length} sucesores en estado Inmediato (Ready Now)</strong> y múltiples perfiles con motivación explícita de <em>movilidad interempresa y proyección en el grupo</em>.
                </div>

                <div class="ai-section-title">🔄 Propuesta IA de Emparejamiento Inter-Empresas (Sinergia de Talento)</div>
                <div class="ai-table-wrap">
                  <table class="ai-table">
                    <thead>
                      <tr>
                        <th>Empresa con Brecha</th>
                        <th>Titular Expuesto</th>
                        <th>Posición / Nivel / GGS</th>
                        <th>Candidato Transversal Sugerido (Grupo Breca)</th>
                        <th>Madurez / Afinidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${matchRows}
                    </tbody>
                  </table>
                </div>

                <div class="ai-alert-box ai-alert-success">
                  <strong>Impacto Estimado:</strong> Implementar una mesa de calibración transversal permite reducir en <strong>más del 60% el riesgo de vacancia crítica</strong> sin recurrir a búsqueda externa (headhunting), reduciendo el tiempo de adaptación ejecutiva.
                </div>
              </div>
            </div>
          </div>
        `,
      };
    }

    // ------------------------------------------------------------------------
    // CASO ABIERTO F: Estrategia Global de Retención, Análisis Abierto General o Consulta de Consultoría
    // ------------------------------------------------------------------------
    const scopeRecords =
      mentionedCompanies.length === 1
        ? allRecords.filter((r) => r.empresa === mentionedCompanies[0])
        : allRecords;
    const scopeLabel =
      mentionedCompanies.length === 1 ? mentionedCompanies[0] : "Grupo Breca (12 Empresas)";

    const critNoSuc = scopeRecords.filter((r) => r.riesgo === "Alto" && !hasSuccessor(r));
    const highRiskLongSuc = scopeRecords.filter(
      (r) =>
        r.riesgo === "Alto" &&
        hasSuccessor(r) &&
        (r.readiness === "3 a 5 años" || r.readiness === "+ de 5 años")
    );
    const topNoSuc = scopeRecords.filter((r) => r.nine_box >= 8 && !hasSuccessor(r));
    const readyNowScope = scopeRecords.filter((r) => hasSuccessor(r) && r.readiness === "Inmediato");

    const priorityRows = [...critNoSuc, ...highRiskLongSuc]
      .slice(0, 8)
      .map(
        (r) => `
        <tr>
          <td><strong>${esc(r.nombre)}</strong></td>
          <td>${esc(r.empresa)}</td>
          <td>${esc(r.posicion)} (${esc(r.nivel)} · GGS ${r.ggs})</td>
          <td><span class="ai-badge ai-badge-indigo">9-Box ${r.nine_box}</span></td>
          <td>${riskBadgeHtml(r.riesgo)}</td>
          <td>${hasSuccessor(r) ? esc(r.sucesor) + " (" + esc(r.readiness) + ")" : '<span class="ai-badge ai-badge-red">⚠️ Sin sucesor</span>'}</td>
          <td>${
            !hasSuccessor(r)
              ? "Asignar back-up interino + retención inmediata"
              : "Acelerar PDI de sucesor (horizonte >3 años)"
          }</td>
        </tr>
      `
      )
      .join("");

    return {
      subType: "strategic_advisory",
      followUps: [
        "¿Cuáles son las empresas más vulnerables del grupo y por qué?",
        "¿Cómo impacta la motivación de los sucesores en el riesgo de transición?",
        "¿Cómo influye el tiempo en la posición actual en el riesgo de fuga?",
      ],
      html: `
        <div class="ai-structured-response">
          <div class="ai-html-card">
            <div class="ai-html-header-open">
              <div>
                <h4 class="ai-html-title">🧠 Análisis Estratégico y Recomendaciones IA · ${esc(scopeLabel)}</h4>
                <div class="ai-html-subtitle">Evaluación analítica sobre ${scopeRecords.length} posiciones activas del reporte 2026_Reporte_Sucesion.xlsx</div>
              </div>
              <span class="ai-badge ai-badge-indigo">Consultoría IA</span>
            </div>
            <div class="ai-html-body">
              <div class="ai-insight-banner">
                <strong>Síntesis Ejecutiva para tu consulta:</strong> Al analizar transversalmente las ${scopeRecords.length} posiciones de <strong>${esc(scopeLabel)}</strong>, se identifican <strong>3 focos estratégicos</strong> que explican la exposición actual: <strong>(1) ${critNoSuc.length} posiciones con Riesgo Alto sin sucesor</strong> (exposición inmediata de continuidad), <strong>(2) ${highRiskLongSuc.length} posiciones con Riesgo Alto pero sucesor a más de 3 años</strong> (brecha temporal de madurez), y <strong>(3) ${topNoSuc.length} líderes Top Talent (9-Box 8–9) sin sucesor</strong> cuyo ascenso está bloqueado por falta de reemplazo.
              </div>

              <div class="ai-step-grid">
                <div class="ai-step-card">
                  <div class="ai-step-card-title">🚨 1. Contención (0 - 30 días)</div>
                  <div class="ai-step-card-text">
                    Intervenir prioritariamente en los <strong>${critNoSuc.length} casos de Riesgo Alto sin sucesor</strong> mediante entrevistas de retención, blindaje de compensación/proyectos y designación de un back-up de emergencia.
                  </div>
                </div>
                <div class="ai-step-card">
                  <div class="ai-step-card-title">⚡ 2. Aceleración (30 - 90 días)</div>
                  <div class="ai-step-card-text">
                    Para los <strong>${highRiskLongSuc.length} titulares en Riesgo Alto con sucesor lejano (&gt;3 años)</strong>, asignar co-liderazgo operativo o emparejar con los <strong>${readyNowScope.length} candidatos Ready Now</strong> del grupo.
                  </div>
                </div>
                <div class="ai-step-card">
                  <div class="ai-step-card-title">🌟 3. Desbloqueo de Top Talent</div>
                  <div class="ai-step-card-text">
                    Nombrar sucesores para los <strong>${topNoSuc.length} líderes 9-Box 8–9 sin cobertura</strong>, habilitando su promoción hacia roles N-1/N-0 sin desproteger la operación.
                  </div>
                </div>
              </div>

              <div class="ai-section-title">🎯 Mapa de Intervención Prioritaria (Riesgo Alto + Brecha Total o Temporal)</div>
              <div class="ai-table-wrap">
                <table class="ai-table">
                  <thead>
                    <tr>
                      <th>Talento Titular</th>
                      <th>Empresa</th>
                      <th>Posición / Nivel</th>
                      <th>9-Box</th>
                      <th>Riesgo</th>
                      <th>Estado de Sucesión</th>
                      <th>Acción Específica Sugerida</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${priorityRows}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      `,
    };
  }

  // ==========================================================================
  // DETECTOR DE CONSULTAS LINEALES / CONVERSACIONALES (Excepción del System Prompt)
  // ==========================================================================
  function checkLinearQuery(question, qNorm, records, mentionedTalents) {
    const clean = qNorm.replace(/[¿?¡!.,;:]/g, "").trim();

    // 1. Saludos breves
    if (/^(hola|buenos dias|buenas tardes|buenas noches|hey|saludos|que tal|hola agente|hola centria)$/.test(clean)) {
      return {
        isLinear: true,
        category: "linear_greeting",
        answer: `<p class="ai-linear-response">¡Hola! 👋 Estoy conectado en vivo con los <strong>${records.length} registros</strong> del reporte de talento y sucesión. Puedes seleccionar una pregunta de referencia arriba o escribir tu consulta directamente.</p>`,
      };
    }

    // 2. Agradecimientos o despedidas
    if (/^(gracias|muchas gracias|ok gracias|perfecto|entendido|listo|genial|excelente)$/.test(clean)) {
      return {
        isLinear: true,
        category: "linear_ courtesy",
        answer: `<p class="ai-linear-response">¡Con gusto! Si necesitas revisar otra posición, comparar candidatos o auditar brechas de sucesión, aquí estoy disponible.</p>`,
      };
    }

    // 3. Pregunta conversacional sobre identidad o ayuda breve
    if (
      clean === "quien eres" ||
      clean === "que haces" ||
      clean === "como funcionas" ||
      clean === "ayuda"
    ) {
      return {
        isLinear: true,
        category: "linear_help",
        answer: `<p class="ai-linear-response">Soy el <strong>Agente IA de Talento y Sucesión de Centria</strong>. Analizo en tiempo real el archivo <code>2026_Reporte_Sucesion.xlsx</code> (${records.length} posiciones en 12 empresas) para generar fichas ejecutivas, comparaciones lado a lado, alertas de riesgo de fuga e informes para el Comité.</p>`,
      };
    }

    // 4. Pregunta lineal simple de conteo total (ej. "¿Cuántos talentos hay en total?")
    if (
      (clean.startsWith("cuantos talentos hay") ||
        clean.startsWith("cuantas posiciones hay") ||
        clean.startsWith("cuantos registros hay") ||
        clean === "total de talentos" ||
        clean === "total de posiciones") &&
      !clean.includes("riesgo") &&
      !clean.includes("sucesor") &&
      !clean.includes("9box")
    ) {
      const companiesCount = new Set(records.map((r) => r.empresa)).size;
      const withSucc = records.filter((r) => hasSuccessor(r)).length;
      return {
        isLinear: true,
        category: "linear_fact",
        answer: `<p class="ai-linear-response">Actualmente el reporte cuenta con <strong>${records.length} posiciones evaluadas</strong> distribuidas en <strong>${companiesCount} empresas</strong> del Grupo Breca, de las cuales <strong>${withSucc}</strong> (${((withSucc / (records.length || 1)) * 100).toFixed(1)}%) tienen sucesor identificado.</p>`,
      };
    }

    // 5. Pregunta lineal puntual de 1 solo atributo de 1 persona (ej. "¿De qué empresa es Javier Carvalho?" o "¿Quién es el sucesor de Javier Carvalho?")
    if (mentionedTalents.length === 1 && !qNorm.includes("ficha") && !qNorm.includes("resum") && !qNorm.includes("situacion") && !qNorm.includes("informacion")) {
      const t = mentionedTalents[0];
      if (qNorm.includes("quien es el sucesor") || qNorm.includes("cual es el sucesor")) {
        const msg = hasSuccessor(t)
          ? `El sucesor asignado para <strong>${esc(t.nombre)}</strong> (${esc(t.posicion)} en <strong>${esc(t.empresa)}</strong>) es <strong>${esc(t.sucesor)}</strong>, con un horizonte de preparación (Readiness) de <strong>${esc(t.readiness)}</strong>.`
          : `<strong>${esc(t.nombre)}</strong> (${esc(t.posicion)} en <strong>${esc(t.empresa)}</strong>) actualmente <strong>no cuenta con un sucesor identificado</strong> y presenta un riesgo de pérdida <strong>${esc(t.riesgo)}</strong>.`;
        return {
          isLinear: true,
          category: "linear_single_attribute",
          answer: `<p class="ai-linear-response">${msg}</p>`,
        };
      }
      if ((qNorm.includes("que cargo tiene") || qNorm.includes("cual es el cargo") || qNorm.includes("que posicion ocupa")) && !qNorm.includes("riesgo")) {
        return {
          isLinear: true,
          category: "linear_single_attribute",
          answer: `<p class="ai-linear-response"><strong>${esc(t.nombre)}</strong> ocupa la posición de <strong>${esc(t.posicion)}</strong> (Nivel ${esc(t.nivel)}, GGS ${t.ggs}) en <strong>${esc(t.empresa)}</strong>.</p>`,
        };
      }
    }

    return null;
  }

  // ==========================================================================
  // 1. FICHA INDIVIDUAL EN ESTRUCTURA HTML
  // ==========================================================================
  function buildIndividualCardHtml(r) {
    const hasSuc = hasSuccessor(r);
    const boxText = nineBoxDesc(r.nine_box);

    let alertClass = "ai-alert-info";
    let diagHtml = "";
    if (r.riesgo === "Alto" && !hasSuc) {
      alertClass = "ai-alert-critical";
      diagHtml = `<strong>🚨 Alerta Crítica de Retención y Sucesión:</strong> <strong>${esc(r.nombre)}</strong> presenta <strong>Riesgo Alto de Pérdida</strong> y <strong>NO cuenta con sucesor identificado</strong>. Se recomienda activar un plan urgente de retención y mapeo de reemplazo en <strong>${esc(r.empresa)}</strong>.`;
    } else if (r.riesgo === "Alto" && hasSuc) {
      alertClass = "ai-alert-critical";
      diagHtml = `<strong>⚠️ Atención Prioritaria de Retención:</strong> Aunque cuenta con <strong>${esc(r.sucesor)}</strong> como sucesor (${esc(r.readiness)}), el titular registra <strong>Riesgo Alto de Pérdida</strong>. Se sugiere acelerar el plan de transición.`;
    } else if (!hasSuc) {
      alertClass = "ai-alert-info";
      diagHtml = `<strong>⚠️ Brecha de Sucesión:</strong> La posición tiene riesgo de pérdida <strong>${esc(r.riesgo)}</strong>, pero aún <strong>no registra sucesor asignado</strong> en el pipeline.`;
    } else if (r.readiness === "Inmediato") {
      alertClass = "ai-alert-success";
      diagHtml = `<strong>✅ Sucesión Blindada (Ready Now):</strong> Posición cubierta por <strong>${esc(r.sucesor)}</strong> con disponibilidad <strong>Inmediata</strong> y riesgo del titular controlado (${esc(r.riesgo)}).`;
    } else {
      alertClass = "ai-alert-info";
      diagHtml = `<strong>📊 Cobertura en Desarrollo:</strong> Cuenta con sucesor identificado (<strong>${esc(r.sucesor)}</strong>) en horizonte de <strong>${esc(r.readiness)}</strong>. Mantener seguimiento periódico de desarrollo.`;
    }

    return `
      <div class="ai-structured-response">
        <div class="ai-html-card">
          <div class="ai-html-header">
            <div>
              <h3 class="ai-html-title">👤 ${esc(r.nombre)}</h3>
              <div class="ai-html-subtitle">${esc(r.posicion)} · ${esc(r.empresa)} · Doc: ${esc(r.documento || "-")}</div>
            </div>
            <span class="ai-badge ai-badge-navy">${esc(r.empresa)} · ${esc(r.nivel)}</span>
          </div>

          <div class="ai-html-body">
            <div class="ai-kpi-grid">
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">Grado Salarial</span>
                <div class="ai-kpi-value">GGS ${r.ggs}</div>
              </div>
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">9box Calibrado</span>
                <div class="ai-kpi-value">9Box ${r.nine_box} <span class="ai-badge ai-badge-blue">${esc(boxText)}</span></div>
              </div>
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">Riesgo de Pérdida</span>
                <div class="ai-kpi-value">${riskBadgeHtml(r.riesgo)}</div>
              </div>
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">Cargo de Valor</span>
                <div class="ai-kpi-value">${
                  r.cargo_valor === "Sí"
                    ? `<span class="ai-badge ai-badge-indigo">⭐ Sí (Crítico)</span>`
                    : `<span class="ai-badge ai-badge-blue">No (Estándar)</span>`
                }</div>
              </div>
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">Tiempo en Posición Actual</span>
                <div class="ai-kpi-value">${esc(r.tiempo_posicion || "-")}</div>
              </div>
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">Sucesor Asignado</span>
                <div class="ai-kpi-value">${hasSuc ? esc(r.sucesor) : `<span class="ai-badge ai-badge-red">Sin sucesor</span>`}</div>
              </div>
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">Readiness del Sucesor</span>
                <div class="ai-kpi-value">${readinessBadgeHtml(r)}</div>
              </div>
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">Motivación del Sucesor</span>
                <div class="ai-kpi-value">${hasSuc ? esc(r.motivacion_sucesor || "-") : "-"}</div>
              </div>
            </div>

            <div class="ai-alert-box ${alertClass}">
              ${diagHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // 2. COMPARACIÓN CRUZADA EN ESTRUCTURA HTML
  // ==========================================================================
  function buildComparisonHtml(talents) {
    const [a, b] = talents;
    const aHasSuc = hasSuccessor(a);
    const bHasSuc = hasSuccessor(b);

    return `
      <div class="ai-structured-response">
        <div class="ai-html-card">
          <div class="ai-html-header">
            <div>
              <h3 class="ai-html-title">⚖️ Comparativa Ejecutiva de Talento y Sucesión</h3>
              <div class="ai-html-subtitle">${esc(a.nombre)} (${esc(a.empresa)}) vs. ${esc(b.nombre)} (${esc(b.empresa)})</div>
            </div>
            <span class="ai-badge ai-badge-navy">Contraste Lado a Lado</span>
          </div>

          <div class="ai-html-body">
            <div class="ai-table-wrap">
              <table class="ai-table">
                <thead>
                  <tr>
                    <th>Indicador</th>
                    <th>${esc(a.nombre)} (${esc(a.empresa)})</th>
                    <th>${esc(b.nombre)} (${esc(b.empresa)})</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Nº de Documento</strong></td>
                    <td>${esc(a.documento || "-")}</td>
                    <td>${esc(b.documento || "-")}</td>
                  </tr>
                  <tr>
                    <td><strong>Nombre de la Posición / Nivel</strong></td>
                    <td>${esc(a.posicion)} <span class="ai-badge ai-badge-blue">${esc(a.nivel)}</span></td>
                    <td>${esc(b.posicion)} <span class="ai-badge ai-badge-blue">${esc(b.nivel)}</span></td>
                  </tr>
                  <tr>
                    <td><strong>Grado (GGS)</strong></td>
                    <td><strong>GGS ${a.ggs}</strong></td>
                    <td><strong>GGS ${b.ggs}</strong></td>
                  </tr>
                  <tr>
                    <td><strong>9box Calibrado</strong></td>
                    <td><strong>9Box ${a.nine_box}</strong> (${esc(nineBoxDesc(a.nine_box))})</td>
                    <td><strong>9Box ${b.nine_box}</strong> (${esc(nineBoxDesc(b.nine_box))})</td>
                  </tr>
                  <tr>
                    <td><strong>Riesgo de Pérdida</strong></td>
                    <td>${riskBadgeHtml(a.riesgo)}</td>
                    <td>${riskBadgeHtml(b.riesgo)}</td>
                  </tr>
                  <tr>
                    <td><strong>Cargo de Valor</strong></td>
                    <td>${a.cargo_valor === "Sí" ? `<span class="ai-badge ai-badge-indigo">⭐ Sí (Crítico)</span>` : "No"}</td>
                    <td>${b.cargo_valor === "Sí" ? `<span class="ai-badge ai-badge-indigo">⭐ Sí (Crítico)</span>` : "No"}</td>
                  </tr>
                  <tr>
                    <td><strong>Tiempo en la Posición Actual</strong></td>
                    <td>${esc(a.tiempo_posicion)}</td>
                    <td>${esc(b.tiempo_posicion)}</td>
                  </tr>
                  <tr>
                    <td><strong>¿Tiene Sucesor? / Nombre Sucesor</strong></td>
                    <td><strong>${aHasSuc ? `Sí · ${esc(a.sucesor)}` : "No · Sin sucesor"}</strong></td>
                    <td><strong>${bHasSuc ? `Sí · ${esc(b.sucesor)}` : "No · Sin sucesor"}</strong></td>
                  </tr>
                  <tr>
                    <td><strong>Readiness del Sucesor</strong></td>
                    <td>${readinessBadgeHtml(a)}</td>
                    <td>${readinessBadgeHtml(b)}</td>
                  </tr>
                  <tr>
                    <td><strong>Motivación del Sucesor</strong></td>
                    <td>${aHasSuc ? esc(a.motivacion_sucesor || "-") : "-"}</td>
                    <td>${bHasSuc ? esc(b.motivacion_sucesor || "-") : "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="ai-alert-box ai-alert-info">
              <strong>🔍 Síntesis Comparativa para el Comité:</strong>
              <ul class="ai-list">
                <li><strong>Jerarquía y Desempeño:</strong> <strong>${esc(a.nombre)}</strong> cuenta con <strong>GGS ${a.ggs}</strong> y <strong>9Box ${a.nine_box}</strong>, mientras que <strong>${esc(b.nombre)}</strong> registra <strong>GGS ${b.ggs}</strong> y <strong>9Box ${b.nine_box}</strong>.</li>
                <li><strong>Exposición al Riesgo:</strong> <strong>${esc(a.nombre)}</strong> presenta riesgo <strong>${esc(a.riesgo)}</strong> frente al riesgo <strong>${esc(b.riesgo)}</strong> de <strong>${esc(b.nombre)}</strong>.</li>
                <li><strong>Madurez de Sucesión:</strong> ${
                  aHasSuc
                    ? `<strong>${esc(a.nombre)}</strong> tiene como sucesor a <strong>${esc(a.sucesor)}</strong> (${esc(a.readiness)})`
                    : `<strong>${esc(a.nombre)}</strong> no cuenta con sucesor asignado`
                }, mientras que ${
                  bHasSuc
                    ? `<strong>${esc(b.nombre)}</strong> tiene como sucesor a <strong>${esc(b.sucesor)}</strong> (${esc(b.readiness)})`
                    : `<strong>${esc(b.nombre)}</strong> no cuenta con sucesor asignado`
                }.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // 3. COMPARACIÓN ENTRE EMPRESAS EN ESTRUCTURA HTML
  // ==========================================================================
  function buildCompanyComparisonHtml(compNames, records) {
    const stats = compNames.map((c) => {
      const rows = records.filter((r) => r.empresa === c);
      const total = rows.length || 1;
      const withSuc = rows.filter((r) => hasSuccessor(r)).length;
      const noSuc = rows.length - withSuc;
      const cov = ((withSuc / total) * 100).toFixed(1);
      const highRisk = rows.filter((r) => r.riesgo === "Alto").length;
      const highRiskNoSuc = rows.filter((r) => r.riesgo === "Alto" && !hasSuccessor(r)).length;
      const readyNow = rows.filter((r) => r.readiness === "Inmediato").length;
      const top9Box = rows.filter((r) => r.nine_box >= 8).length;
      const critical = rows.filter((r) => r.cargo_valor === "Sí").length;
      return { c, count: rows.length, withSuc, noSuc, cov, highRisk, highRiskNoSuc, readyNow, top9Box, critical };
    });

    const [s1, s2] = stats;

    return `
      <div class="ai-structured-response">
        <div class="ai-html-card">
          <div class="ai-html-header">
            <div>
              <h3 class="ai-html-title">🏢 Comparativa de Salud de Sucesión por Empresa</h3>
              <div class="ai-html-subtitle">${esc(s1.c)} vs. ${esc(s2.c)}</div>
            </div>
            <span class="ai-badge ai-badge-navy">Benchmarking Corporativo</span>
          </div>

          <div class="ai-html-body">
            <div class="ai-table-wrap">
              <table class="ai-table">
                <thead>
                  <tr>
                    <th>Indicador Clave</th>
                    <th>${esc(s1.c)}</th>
                    <th>${esc(s2.c)}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Posiciones Evaluadas</strong></td>
                    <td><strong>${s1.count}</strong></td>
                    <td><strong>${s2.count}</strong></td>
                  </tr>
                  <tr>
                    <td><strong>Cargos de Valor (Críticos)</strong></td>
                    <td>${s1.critical}</td>
                    <td>${s2.critical}</td>
                  </tr>
                  <tr>
                    <td><strong>Cobertura de Sucesión</strong></td>
                    <td><span class="ai-badge ai-badge-blue">${s1.cov}% (${s1.withSuc}/${s1.count})</span></td>
                    <td><span class="ai-badge ai-badge-blue">${s2.cov}% (${s2.withSuc}/${s2.count})</span></td>
                  </tr>
                  <tr>
                    <td><strong>Brecha Sin Sucesor</strong></td>
                    <td><span class="ai-badge ${s1.noSuc > 0 ? "ai-badge-red" : "ai-badge-green"}">${s1.noSuc} sin sucesor</span></td>
                    <td><span class="ai-badge ${s2.noSuc > 0 ? "ai-badge-red" : "ai-badge-green"}">${s2.noSuc} sin sucesor</span></td>
                  </tr>
                  <tr>
                    <td><strong>Sucesión Inmediata (Ready Now)</strong></td>
                    <td><span class="ai-badge ai-badge-green">🟢 ${s1.readyNow} posiciones</span></td>
                    <td><span class="ai-badge ai-badge-green">🟢 ${s2.readyNow} posiciones</span></td>
                  </tr>
                  <tr>
                    <td><strong>Talento Top (9-Box 8 y 9)</strong></td>
                    <td>🌟 ${s1.top9Box} talentos</td>
                    <td>🌟 ${s2.top9Box} talentos</td>
                  </tr>
                  <tr>
                    <td><strong>Riesgo de Pérdida Alto</strong></td>
                    <td><span class="ai-badge ai-badge-red">🔴 ${s1.highRisk} posiciones</span></td>
                    <td><span class="ai-badge ai-badge-red">🔴 ${s2.highRisk} posiciones</span></td>
                  </tr>
                  <tr>
                    <td><strong>Riesgo Alto + Sin Sucesor</strong></td>
                    <td><strong>🚨 ${s1.highRiskNoSuc} casos críticos</strong></td>
                    <td><strong>🚨 ${s2.highRiskNoSuc} casos críticos</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="ai-alert-box ai-alert-info">
              <strong>📌 Conclusión Ejecutiva:</strong> <strong>${esc(s1.c)}</strong> registra una cobertura de sucesión de <strong>${s1.cov}%</strong> (${s1.readyNow} Ready Now y ${s1.highRiskNoSuc} en riesgo crítico sin sucesor), mientras que <strong>${esc(s2.c)}</strong> alcanza <strong>${s2.cov}%</strong> de cobertura (${s2.readyNow} Ready Now y ${s2.highRiskNoSuc} en riesgo crítico sin sucesor).
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // 4. INFORME EJECUTIVO INTEGRAL PARA EL COMITÉ DE TALENTO (HTML ESTRUCTURADO)
  // ==========================================================================
  function buildExecutiveReportHtml(records) {
    const total = records.length || 1;
    const withSuc = records.filter((r) => hasSuccessor(r)).length;
    const noSuc = records.length - withSuc;
    const covPct = ((withSuc / total) * 100).toFixed(1);

    const criticalRoles = records.filter((r) => r.cargo_valor === "Sí");
    const criticalNoSuc = criticalRoles.filter((r) => !hasSuccessor(r));

    const highRisk = records.filter((r) => r.riesgo === "Alto");
    const highRiskNoSuc = highRisk.filter((r) => !hasSuccessor(r));

    const readyNow = records.filter((r) => hasSuccessor(r) && r.readiness === "Inmediato");
    const r1to3 = records.filter((r) => hasSuccessor(r) && r.readiness === "1 a 3 años");
    const r3to5 = records.filter((r) => hasSuccessor(r) && r.readiness === "3 a 5 años");
    const rOver5 = records.filter((r) => hasSuccessor(r) && r.readiness === "+ de 5 años");

    const criticalRowsHtml = highRiskNoSuc
      .map(
        (r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${esc(r.empresa)}</strong></td>
          <td><strong>${esc(r.nombre)}</strong></td>
          <td>${esc(r.posicion)} <span class="ai-badge ai-badge-blue">${esc(r.nivel)}</span></td>
          <td>GGS ${r.ggs}</td>
          <td>9Box ${r.nine_box}</td>
          <td>${r.cargo_valor === "Sí" ? `<span class="ai-badge ai-badge-indigo">⭐ Sí</span>` : "No"}</td>
        </tr>
      `
      )
      .join("");

    return `
      <div class="ai-structured-response">
        <div class="ai-html-card">
          <div class="ai-html-header">
            <div>
              <h3 class="ai-html-title">📊 Informe Ejecutivo para el Comité de Talento y Sucesión</h3>
              <div class="ai-html-subtitle">Consolidado Corporativo · ${records.length} posiciones evaluadas en 12 unidades de negocio</div>
            </div>
            <span class="ai-badge ai-badge-navy">Comité 2026</span>
          </div>

          <div class="ai-html-body">
            <div class="ai-kpi-grid">
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">Total Evaluados</span>
                <div class="ai-kpi-value">${records.length}</div>
              </div>
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">Cobertura Sucesión</span>
                <div class="ai-kpi-value">${covPct}% (${withSuc})</div>
              </div>
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">Brecha Sin Sucesor</span>
                <div class="ai-kpi-value"><span class="ai-badge ai-badge-red">${noSuc} posiciones</span></div>
              </div>
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">Sucesión Inmediata</span>
                <div class="ai-kpi-value"><span class="ai-badge ai-badge-green">${readyNow.length} Ready Now</span></div>
              </div>
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">Cargos Críticos S/S</span>
                <div class="ai-kpi-value"><span class="ai-badge ai-badge-amber">${criticalNoSuc.length} de ${criticalRoles.length}</span></div>
              </div>
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">Alerta Roja (Alto S/S)</span>
                <div class="ai-kpi-value"><span class="ai-badge ai-badge-red">🚨 ${highRiskNoSuc.length} casos</span></div>
              </div>
            </div>

            <div class="ai-section-title">🚨 1. Posiciones Prioritarias en Alerta Roja (Riesgo Alto + Sin Sucesor)</div>
            <div class="ai-table-wrap">
              <table class="ai-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Empresa</th>
                    <th>Talento Titular</th>
                    <th>Posición / Nivel</th>
                    <th>GGS</th>
                    <th>9-Box</th>
                    <th>Cargo Valor</th>
                  </tr>
                </thead>
                <tbody>
                  ${criticalRowsHtml}
                </tbody>
              </table>
            </div>

            <div class="ai-section-title">⏳ 2. Matriz de Madurez del Pipeline (Readiness)</div>
            <div class="ai-table-wrap">
              <table class="ai-table">
                <thead>
                  <tr>
                    <th>Horizonte de Preparación</th>
                    <th>Posiciones</th>
                    <th>% del Total</th>
                    <th>Estado Ejecutivo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Inmediato (Ready Now)</strong></td>
                    <td><strong>${readyNow.length}</strong></td>
                    <td>${((readyNow.length / total) * 100).toFixed(1)}%</td>
                    <td><span class="ai-badge ai-badge-green">🟢 Listos para asumir</span></td>
                  </tr>
                  <tr>
                    <td><strong>1 a 3 años</strong></td>
                    <td><strong>${r1to3.length}</strong></td>
                    <td>${((r1to3.length / total) * 100).toFixed(1)}%</td>
                    <td><span class="ai-badge ai-badge-blue">🔵 En desarrollo activo</span></td>
                  </tr>
                  <tr>
                    <td><strong>3 a 5 años</strong></td>
                    <td><strong>${r3to5.length}</strong></td>
                    <td>${((r3to5.length / total) * 100).toFixed(1)}%</td>
                    <td><span class="ai-badge ai-badge-amber">🟡 Mediano plazo</span></td>
                  </tr>
                  <tr>
                    <td><strong>+ de 5 años (&gt; 5 años)</strong></td>
                    <td><strong>${rOver5.length}</strong></td>
                    <td>${((rOver5.length / total) * 100).toFixed(1)}%</td>
                    <td><span class="ai-badge ai-badge-amber">🟠 Largo plazo</span></td>
                  </tr>
                  <tr>
                    <td><strong>Sin Sucesor Asignado</strong></td>
                    <td><strong>${noSuc}</strong></td>
                    <td>${((noSuc / total) * 100).toFixed(1)}%</td>
                    <td><span class="ai-badge ai-badge-red">⚠️ Brecha de cobertura</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="ai-alert-box ai-alert-info">
              <strong>🎯 Plan de Acción Recomendado para el Comité:</strong>
              <ul class="ai-list">
                <li><strong>Retención Inmediata:</strong> Priorizar planes de fidelización en las <strong>${highRiskNoSuc.length} posiciones con Riesgo Alto y sin sucesor</strong>.</li>
                <li><strong>Blindaje de Cargos de Valor:</strong> Asignar candidatos internos o mapeo externo para los <strong>${criticalNoSuc.length} Cargos de Valor sin cobertura</strong>.</li>
                <li><strong>Aceleración de Sucesores:</strong> Impulsar mentoría ejecutiva para pasar candidatos del horizonte <em>1 a 3 años</em> (${r1to3.length} posiciones) a <em>Ready Now</em>.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // 5. TABLA ESTRUCTURADA HTML PARA FILTROS DE RIESGO, BRECHAS O EMPRESAS
  // ==========================================================================
  function buildFilteredTableHtml(title, subtitle, filtered, totalScopeCount) {
    if (filtered.length === 0) {
      return `
        <div class="ai-structured-response">
          <div class="ai-html-card">
            <div class="ai-html-header">
              <div>
                <h3 class="ai-html-title">${esc(title)}</h3>
                <div class="ai-html-subtitle">${esc(subtitle)}</div>
              </div>
              <span class="ai-badge ai-badge-green">0 Casos</span>
            </div>
            <div class="ai-html-body">
              <div class="ai-alert-box ai-alert-success">
                ✅ No se registran posiciones que coincidan con este criterio en el conjunto de datos actual.
              </div>
            </div>
          </div>
        </div>
      `;
    }

    const withSuc = filtered.filter((r) => hasSuccessor(r)).length;
    const highRisk = filtered.filter((r) => r.riesgo === "Alto").length;
    const critical = filtered.filter((r) => r.cargo_valor === "Sí").length;

    const rowsHtml = filtered
      .map(
        (r, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${esc(r.empresa)}</strong></td>
          <td><strong>${esc(r.nombre)}</strong></td>
          <td>${esc(r.posicion)} <span class="ai-badge ai-badge-blue">${esc(r.nivel)}</span></td>
          <td>GGS ${r.ggs}</td>
          <td>9Box ${r.nine_box}</td>
          <td>${riskBadgeHtml(r.riesgo)}</td>
          <td>${hasSuccessor(r) ? esc(r.sucesor) : `<span class="ai-badge ai-badge-red">Sin sucesor</span>`}</td>
          <td>${readinessBadgeHtml(r)}</td>
        </tr>
      `
      )
      .join("");

    return `
      <div class="ai-structured-response">
        <div class="ai-html-card">
          <div class="ai-html-header">
            <div>
              <h3 class="ai-html-title">${esc(title)}</h3>
              <div class="ai-html-subtitle">${esc(subtitle)}</div>
            </div>
            <span class="ai-badge ai-badge-navy">${filtered.length} de ${totalScopeCount} posiciones</span>
          </div>

          <div class="ai-html-body">
            <div class="ai-kpi-grid">
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">Posiciones Encontradas</span>
                <div class="ai-kpi-value">${filtered.length}</div>
              </div>
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">Cargos de Valor</span>
                <div class="ai-kpi-value">${critical} críticos</div>
              </div>
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">Con Sucesor</span>
                <div class="ai-kpi-value">${withSuc} (${((withSuc / filtered.length) * 100).toFixed(0)}%)</div>
              </div>
              <div class="ai-kpi-box">
                <span class="ai-kpi-label">Riesgo Alto</span>
                <div class="ai-kpi-value"><span class="ai-badge ai-badge-red">${highRisk} en riesgo alto</span></div>
              </div>
            </div>

            <div class="ai-table-wrap">
              <table class="ai-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Empresa</th>
                    <th>Talento</th>
                    <th>Posición / Nivel</th>
                    <th>GGS</th>
                    <th>9-Box</th>
                    <th>Riesgo</th>
                    <th>Sucesor</th>
                    <th>Readiness</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // ENRUTADOR DE INTENCIÓN PÚBLICO Y PUNTO DE ENTRADA DEL AGENTE IA EN CLIENTE
  // ==========================================================================
  window.classifyTalentQueryIntent = function (question, records) {
    const qNorm = norm(question);
    const allRecords = Array.isArray(records) ? records : [];
    const mentionedTalents = findMentionedTalents(qNorm, allRecords);
    const mentionedCompanies = findMentionedCompanies(qNorm, allRecords);

    const linearCheck = checkLinearQuery(question, qNorm, allRecords, mentionedTalents);
    if (linearCheck) {
      return {
        route: "LINEAR",
        routeLabel: "Respuesta Directa",
        mentionedTalents,
        mentionedCompanies,
      };
    }

    if (isOpenAnalyticalQuestion(qNorm)) {
      return {
        route: "OPEN_ANALYSIS",
        routeLabel: "🧠 Análisis Abierto · Gemini IA",
        mentionedTalents,
        mentionedCompanies,
      };
    }

    return {
      route: "TEMPLATE",
      routeLabel: "⚡ Plantilla Ejecutiva · Datos Exactos",
      mentionedTalents,
      mentionedCompanies,
    };
  };

  window.answerTalentQuestionClient = function (question, records) {
    const qNorm = norm(question);
    const allRecords = Array.isArray(records) ? records : [];

    // 1. Detectar talentos y empresas mencionadas
    const mentionedTalents = findMentionedTalents(qNorm, allRecords);
    const mentionedCompanies = findMentionedCompanies(qNorm, allRecords);

    // 2. Verificar primero si es una consulta lineal/conversacional (Excepción del System Prompt)
    const linearCheck = checkLinearQuery(question, qNorm, allRecords, mentionedTalents);
    if (linearCheck) {
      return {
        ...linearCheck,
        route: "LINEAR",
        routeLabel: "Respuesta Directa",
        followUps: [
          "Genera un resumen ejecutivo de los principales riesgos y brechas de sucesión para el Comité de Talento.",
          "¿Cuáles son las empresas más vulnerables del grupo y por qué?",
        ],
      };
    }

    // 3. Evaluar si es una Pregunta Abierta de Análisis, Estrategia, Retención o Diagnóstico Causal
    if (isOpenAnalyticalQuestion(qNorm)) {
      const openRes = buildOpenAnalysisHtml(
        question,
        qNorm,
        allRecords,
        mentionedTalents,
        mentionedCompanies
      );
      return {
        isLinear: false,
        route: "OPEN_ANALYSIS",
        routeLabel: "🧠 Análisis Abierto · Gemini IA",
        category: openRes.subType || "open_analysis",
        answer: openRes.html,
        followUps: openRes.followUps || [],
      };
    }

    // 4. PLANTILLA: Comparación entre 2 o más talentos mencionados
    if (mentionedTalents.length >= 2) {
      const tA = mentionedTalents[0];
      const tB = mentionedTalents[1];
      return {
        isLinear: false,
        route: "TEMPLATE",
        routeLabel: "⚡ Plantilla Ejecutiva · Comparación Cruzada",
        category: "comparison",
        answer: buildComparisonHtml(mentionedTalents.slice(0, 2)),
        followUps: [
          `¿Qué plan de retención y aceleración recomiendas para ${tA.nombre}?`,
          `¿Qué plan de retención y aceleración recomiendas para ${tB.nombre}?`,
        ],
      };
    }

    // 5. PLANTILLA: Ficha Ejecutiva Individual cuando se menciona a 1 talento
    if (mentionedTalents.length === 1) {
      const t = mentionedTalents[0];
      return {
        isLinear: false,
        route: "TEMPLATE",
        routeLabel: "⚡ Plantilla Ejecutiva · Ficha Individual",
        category: "individual_card",
        answer: buildIndividualCardHtml(t),
        followUps: [
          `¿Qué plan de retención y sucesión recomiendas para ${t.nombre}?`,
          `Genera un resumen de los talentos registrados en ${t.empresa}.`,
        ],
      };
    }

    // 6. PLANTILLA: Búsqueda inversa por nombre de sucesor (ej. "¿De quién es sucesora Carla Silva?")
    const successorMatches = findMentionedSuccessors(qNorm, allRecords);
    if (successorMatches.length > 0) {
      const sucName = successorMatches[0].sucesor;
      return {
        isLinear: false,
        route: "TEMPLATE",
        routeLabel: "⚡ Plantilla Ejecutiva · Mapeo de Sucesor",
        category: "successor_lookup",
        answer: buildFilteredTableHtml(
          `🔄 Asignación de Sucesión: ${sucName}`,
          `Posiciones donde ${sucName} figura como sucesor(a) designado(a)`,
          successorMatches,
          allRecords.length
        ),
        followUps: [
          `Genera la ficha ejecutiva de ${successorMatches[0].nombre}.`,
          "¿Cómo impacta la motivación de los sucesores en el riesgo de transición?",
        ],
      };
    }

    // 7. PLANTILLA: Comparación entre 2 empresas mencionadas
    if (mentionedCompanies.length >= 2 && (qNorm.includes("compar") || qNorm.includes(" vs "))) {
      return {
        isLinear: false,
        route: "TEMPLATE",
        routeLabel: "⚡ Plantilla Ejecutiva · Comparativa de Empresas",
        category: "company_comparison",
        answer: buildCompanyComparisonHtml(mentionedCompanies.slice(0, 2), allRecords),
        followUps: [
          "¿Cuáles son las empresas más vulnerables del grupo y por qué?",
          "¿Cómo cubrir las brechas de sucesión con movilidad entre empresas del grupo?",
        ],
      };
    }

    // 8. PLANTILLA: Consultas de Comité / Resumen Ejecutivo Global
    const isExecutiveSummary =
      mentionedCompanies.length === 0 &&
      (qNorm.includes("comite") ||
        qNorm.includes("resumen ejecutivo") ||
        qNorm.includes("principales hallazgos") ||
        (qNorm.includes("cobertura inmediata") && qNorm.includes("en desarrollo") && qNorm.includes("sin cobertura")));

    if (isExecutiveSummary) {
      return {
        isLinear: false,
        route: "TEMPLATE",
        routeLabel: "⚡ Plantilla Ejecutiva · Informe de Comité",
        category: "executive_report",
        answer: buildExecutiveReportHtml(allRecords),
        followUps: [
          "¿Cuáles son las empresas más vulnerables del grupo y por qué?",
          "¿Cómo cubrir las brechas críticas con talento de otras empresas del grupo?",
          "¿Cómo impacta la motivación de los sucesores en el riesgo de transición?",
        ],
      };
    }

    // 9. PLANTILLA: Filtrado Analítico Combinado (Empresa, Riesgo, Sucesor, Readiness, 9-Box, Cargo de Valor, Nivel, GGS)
    let subset = [...allRecords];
    const criteriaParts = [];

    if (mentionedCompanies.length === 1) {
      const comp = mentionedCompanies[0];
      subset = subset.filter((r) => r.empresa === comp);
      criteriaParts.push(`Unidad: ${comp}`);
    }

    // Filtro por Riesgo
    if (qNorm.includes("riesgo alto") || qNorm.includes("alto riesgo")) {
      subset = subset.filter((r) => r.riesgo === "Alto");
      criteriaParts.push("Riesgo Alto");
    } else if (qNorm.includes("riesgo medio")) {
      subset = subset.filter((r) => r.riesgo === "Medio");
      criteriaParts.push("Riesgo Medio");
    } else if (qNorm.includes("riesgo bajo")) {
      subset = subset.filter((r) => r.riesgo === "Bajo");
      criteriaParts.push("Riesgo Bajo");
    }

    // Filtro por Sucesor / Readiness
    const asksNoSuccessor =
      qNorm.includes("sin sucesor") ||
      qNorm.includes("no cuentan con sucesor") ||
      qNorm.includes("no tienen sucesor") ||
      qNorm.includes("ausencia de sucesor") ||
      qNorm.includes("brechas de sucesion") ||
      qNorm.includes("sin cobertura");

    const asksOver3Years =
      qNorm.includes("mas de tres anos") ||
      qNorm.includes("mas de 3 anos") ||
      qNorm.includes("3 a 5 anos") ||
      qNorm.includes("mayor a 3 anos");

    const asksOver5Years =
      qNorm.includes("superior a cinco anos") ||
      qNorm.includes("mas de cinco anos") ||
      qNorm.includes("mas de 5 anos") ||
      qNorm.includes("+ de 5 anos");

    const asksImmediate =
      qNorm.includes("inmediat") || qNorm.includes("ready now");

    if (asksNoSuccessor && !asksImmediate) {
      subset = subset.filter((r) => !hasSuccessor(r));
      criteriaParts.push("Sin Sucesor");
    } else if (asksOver5Years) {
      subset = subset.filter((r) => hasSuccessor(r) && r.readiness === "+ de 5 años");
      criteriaParts.push("Readiness > 5 años");
    } else if (asksOver3Years) {
      subset = subset.filter(
        (r) => hasSuccessor(r) && (r.readiness === "3 a 5 años" || r.readiness === "+ de 5 años")
      );
      criteriaParts.push("Readiness > 3 años (3 a 5 o +5 años)");
    } else if (asksImmediate) {
      subset = subset.filter((r) => hasSuccessor(r) && r.readiness === "Inmediato");
      criteriaParts.push("Readiness Inmediato (Ready Now)");
    } else if (qNorm.includes("1 a 3 anos")) {
      subset = subset.filter((r) => hasSuccessor(r) && r.readiness === "1 a 3 años");
      criteriaParts.push("Readiness 1 a 3 años");
    }

    // Filtro por 9-Box
    if (
      qNorm.includes("9box 8 o 9") ||
      qNorm.includes("9-box 8 o 9") ||
      qNorm.includes("9box alto") ||
      qNorm.includes("top talent")
    ) {
      subset = subset.filter((r) => r.nine_box >= 8);
      criteriaParts.push("9-Box 8 y 9 (Top Talent)");
    } else {
      const boxMatch = qNorm.match(/9\s*-?\s*box\s*(\d)/);
      if (boxMatch) {
        const bNum = Number(boxMatch[1]);
        subset = subset.filter((r) => r.nine_box === bNum);
        criteriaParts.push(`Cuadrante 9-Box ${bNum}`);
      }
    }

    // Filtro por Cargo de Valor / Posición Crítica
    if (
      qNorm.includes("cargo de valor") ||
      qNorm.includes("cargos de valor") ||
      qNorm.includes("posiciones criticas") ||
      qNorm.includes("posicion critica")
    ) {
      subset = subset.filter((r) => r.cargo_valor === "Sí");
      criteriaParts.push("Cargos de Valor (Críticos)");
    }

    // Filtro por Nivel Jerárquico (N-1, N-2, N-3)
    const nivelMatch = qNorm.match(/\bn\s*-\s*([0123])\b/);
    if (nivelMatch) {
      const niv = `N-${nivelMatch[1]}`;
      subset = subset.filter((r) => r.nivel.toUpperCase() === niv);
      criteriaParts.push(`Nivel ${niv}`);
    }

    // Filtro por GGS
    const ggsMatch = qNorm.match(/\bggs\s*(\d{2})\b/);
    if (ggsMatch) {
      const ggsVal = Number(ggsMatch[1]);
      subset = subset.filter((r) => r.ggs === ggsVal);
      criteriaParts.push(`GGS ${ggsVal}`);
    }

    // Si preguntó por "principales riesgos" en una empresa y aún no filtró por riesgo
    if (mentionedCompanies.length === 1 && qNorm.includes("riesgo") && !criteriaParts.some((c) => c.includes("Riesgo"))) {
      subset = subset.filter((r) => r.riesgo === "Alto" || !hasSuccessor(r));
      criteriaParts.push("Riesgo Alto o Brecha de Sucesión");
    }

    if (criteriaParts.length > 0) {
      return {
        isLinear: false,
        route: "TEMPLATE",
        routeLabel: "⚡ Plantilla Ejecutiva · Filtro de Datos",
        category: "filtered_analysis",
        answer: buildFilteredTableHtml(
          `🔎 Diagnóstico de Talento: ${criteriaParts.join(" · ")}`,
          `Resultados verificados sobre el reporte 2026_Reporte_Sucesion.xlsx`,
          subset,
          allRecords.length
        ),
        followUps: [
          "¿Qué estrategia recomiendas para mitigar estos riesgos?",
          "¿Cómo cubrir las brechas de sucesión con movilidad entre empresas del grupo?",
        ],
      };
    }

    // 10. Si no coincidió con ningún filtro estructurado de plantilla, enrutar al Motor de Análisis Abierto IA
    const openFallback = buildOpenAnalysisHtml(
      question,
      qNorm,
      allRecords,
      mentionedTalents,
      mentionedCompanies
    );
    return {
      isLinear: false,
      route: "OPEN_ANALYSIS",
      routeLabel: "🧠 Análisis Abierto · Gemini IA",
      category: openFallback.subType || "open_analysis",
      answer: openFallback.html,
      followUps: openFallback.followUps || [],
    };
  };
})();
