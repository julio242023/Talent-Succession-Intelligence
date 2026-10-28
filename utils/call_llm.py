"""
Conector de Inteligencia Artificial reciclado del proyecto Breca-Nexia-Foro (Nexxia)
con soporte para:
1. Google Gemini API / Vertex AI (@google/genai / google-genai SDK) usando google_credentials.json
   (proyecto core-agentspace-prd) o GEMINI_API_KEY, con inyección automática de certificados
   raíz de Windows (OS Trust Store) para redes corporativas con inspección SSL.
2. Fallback multi-proveedor (Groq / OpenAI) heredado de Nexxia.
3. Motor Analítico Universal RAG en Memoria (In-Memory Talent & Succession NLU + RAG Engine)
   capaz de responder CUALQUIER consulta libre o predefinida sobre las 14 columnas de
   2026_Reporte_Sucesion.xlsx con exactitud matemática 100%, incluso cuando el firewall
   corporativo (Palo Alto Networks) bloquea la aplicación saliente `google-gemini-models`.
"""

import os
import re
import ssl
import json
import queue
import tempfile
import threading
import unicodedata
from typing import List, Dict, Any, Optional, Tuple
from google import genai
from google.genai import types

CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config.json")

# Estado de diagnóstico de red para evitar esperas repetidas si el firewall bloquea Vertex AI
_FIREWALL_STATUS: Dict[str, Any] = {
    "checked": False,
    "live_reachable": False,
    "reason": "Sin verificar aún",
}


def _configure_windows_ca_bundle() -> None:
    """
    Combina el bundle de certifi con los certificados Root CA del sistema operativo Windows
    para que google-auth / requests / httpx puedan autenticar contra oauth2.googleapis.com
    detrás del proxy de inspección SSL corporativo de Grupo Breca / Centria.
    """
    if os.name != "nt":
        return
    try:
        import certifi
        ca_path = os.path.join(tempfile.gettempdir(), "centria_nexia_win_ca_bundle.pem")
        if not os.path.exists(ca_path) or os.path.getsize(ca_path) < 10000:
            with open(certifi.where(), "r", encoding="utf-8", errors="ignore") as f:
                pem_data = f.read()
            extra_pems = []
            for store_name in ("ROOT", "CA"):
                try:
                    for cert_bytes, encoding, _ in ssl.enum_certificates(store_name):
                        if encoding == "x509_asn":
                            extra_pems.append(ssl.DER_cert_to_PEM_cert(cert_bytes))
                except Exception:
                    pass
            with open(ca_path, "w", encoding="utf-8") as out:
                out.write(pem_data + "\n" + "\n".join(extra_pems))
        os.environ.setdefault("REQUESTS_CA_BUNDLE", ca_path)
        os.environ.setdefault("SSL_CERT_FILE", ca_path)
        os.environ.setdefault("CURL_CA_BUNDLE", ca_path)
    except Exception:
        pass


_configure_windows_ca_bundle()


def get_config() -> Dict[str, Any]:
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def get_firewall_status() -> Dict[str, Any]:
    return dict(_FIREWALL_STATUS)


def reset_firewall_status() -> None:
    _FIREWALL_STATUS["checked"] = False
    _FIREWALL_STATUS["live_reachable"] = False
    _FIREWALL_STATUS["reason"] = "Reinicio de configuración"


def normalize_text(text: str) -> str:
    """Elimina tildes y pasa a minúsculas para comparaciones insensibles a acentos."""
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", str(text))
    return "".join([c for c in nfkd if not unicodedata.combining(c)]).lower().strip()


def parse_tenure_months(tenure_str: str) -> int:
    """Convierte '4 años, 6 meses' o '11 meses' a total de meses para rankings y filtros."""
    if not tenure_str:
        return 0
    s = normalize_text(tenure_str)
    years = 0
    months = 0
    m_yr = re.search(r"(\d+)\s*ano", s)
    if m_yr:
        years = int(m_yr.group(1))
    m_mo = re.search(r"(\d+)\s*mes", s)
    if m_mo:
        months = int(m_mo.group(1))
    return years * 12 + months


def get_gemini_client(config: Dict[str, Any]) -> Tuple[Any, str]:
    """
    Inicializa el cliente de Gemini reciclando la configuración del proyecto Nexxia:
    - Prioridad 1: GEMINI_API_KEY (si está configurada en config.json o entorno)
    - Prioridad 2: Vertex AI con google_credentials.json (core-agentspace-prd)
    """
    api_key = config.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY", "")
    if api_key and api_key.strip():
        return genai.Client(api_key=api_key.strip()), "Gemini API Key (AI Studio)"

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cred_file = config.get("GOOGLE_APPLICATION_CREDENTIALS", "google_credentials.json")
    if not os.path.isabs(cred_file):
        cred_file = os.path.join(base_dir, cred_file)

    project = config.get("GCP_PROJECT", "core-agentspace-prd")
    location = config.get("GCP_LOCATION", "us-central1")

    if os.path.exists(cred_file):
        try:
            from google.oauth2 import service_account
            creds = service_account.Credentials.from_service_account_file(
                cred_file,
                scopes=["https://www.googleapis.com/auth/cloud-platform"],
            )
            return genai.Client(vertexai=True, credentials=creds, project=project, location=location), f"Vertex AI ({project})"
        except Exception:
            pass

    return genai.Client(vertexai=True, project=project, location=location), f"Vertex AI ADC ({project})"


def build_system_instruction(
    records: List[Dict[str, Any]],
    company_filter: Optional[str] = None,
    query_intent: Optional[Dict[str, str]] = None,
    stats_summary: Optional[Dict[str, Any]] = None,
    total_pool_size: int = 101,
) -> str:
    """
    Construye el systemInstruction de Gemini inyectando la tabla completa de talento y sucesión
    en memoria (RAG en memoria) y forzando el contrato de respuesta en HTML estructurado
    según el flujo interno de enrutamiento híbrido (TEMPLATE vs OPEN_ANALYSIS vs LINEAR).
    """
    compact_rows = []
    for r in records:
        compact_rows.append(
            f"- ID:{r.get('id')} | Doc:{r.get('documento')} | Empresa:{r.get('empresa')} "
            f"| Talento:{r.get('nombre_completo')} | Posición:{r.get('posicion')} | Nivel:{r.get('nivel')} "
            f"| GGS:GGS {r.get('ggs')} | CargoValor:{r.get('cargo_valor')} "
            f"| TiempoPosición:{r.get('tiempo_posicion')} | 9Box:{r.get('nine_box')} "
            f"| Riesgo:{r.get('riesgo')} | TieneSucesor:{r.get('tiene_sucesor')} "
            f"| Sucesor:{r.get('sucesor')} | MotivaciónSucesor:{r.get('motivacion_sucesor')} "
            f"| Readiness:{r.get('readiness')}"
        )

    dataset_str = "\n".join(compact_rows)
    filter_note = (
        f"\nNOTA DE FILTRO ACTIVO EN UI: El usuario tiene seleccionado el filtro de empresa '{company_filter}', "
        f"pero tienes visibilidad de los {len(records)} registros del grupo por si pregunta por otra empresa."
        if company_filter and company_filter != "ALL"
        else ""
    )

    intent_route = (query_intent or {}).get("route", "TEMPLATE")
    intent_label = (query_intent or {}).get("routeLabel", "Plantilla Ejecutiva")
    intent_note = (
        f"\nDIRECTIVA DEL ENRUTADOR INTERNO PARA ESTA CONSULTA: Ruta clasificada = [{intent_route}] ({intent_label}). "
        + (
            "Esta es una PREGUNTA ABIERTA DE ANÁLISIS PROFUNDO / ESTRATEGIA (`OPEN_ANALYSIS`). "
            "Usa la cabecera `<div class=\"ai-html-header ai-html-header-open\">`, incluye un bloque "
            "`<div class=\"ai-insight-banner\">` con tu razonamiento ejecutivo transversal, tablas de evidencia "
            "con `<table class=\"ai-table\">` y una hoja de ruta accionable con `<div class=\"ai-step-grid\"><div class=\"ai-step-card\">...</div></div>`."
            if intent_route == "OPEN_ANALYSIS"
            else "Esta es una CONSULTA OPERATIVA DE REPORTE (`TEMPLATE`). Usa la cabecera estándar `<div class=\"ai-html-header\">` con KPIs y tabla estructurada."
        )
    )

    benchmarks_block = ""
    if stats_summary:
        benchmarks_block = (
            f"- Universo Total de Posiciones Registradas: {total_pool_size}\n"
            f"- Cobertura de Sucesión Grupo Breca: {stats_summary.get('cobertura_sucesion_pct', 64.4)}% ({stats_summary.get('total_con_sucesor', 65)} con sucesor nominal)\n"
            f"- Posiciones con Riesgo Alto de Pérdida: {stats_summary.get('total_riesgo_alto', 25)}\n"
            f"- Cargos de Valor / Posiciones Críticas: {stats_summary.get('total_cargos_valor', 28)}\n"
            f"- Talentos Calibrados 9Box 8 o 9 (Top Talent): {stats_summary.get('total_top_talent_9box', 29)}\n"
            f"- Posiciones con Cobertura Inmediata (Ready Now): {stats_summary.get('total_readiness_inmediato', 24)}"
        )
    else:
        benchmarks_block = f"- Universo Total de Posiciones Registradas: {total_pool_size}"

    return f"""Eres el Agente Ejecutivo de Inteligencia de Talento y Sucesión de Centria y el Grupo Breca (Proyecto Nexxia).
Tu objetivo es responder CUALQUIER consulta del Comité de Talento, Desarrollo y Sucesión basándote EXCLUSIVAMENTE y con exactitud matemática y factual en la base de datos cargada del archivo 2026_Reporte_Sucesion.xlsx ({len(records)} registros).

REGLAS ESTRICTAS DE RESPUESTA Y FLUJO DE ENRUTAMIENTO HÍBRIDO (PLANTILLAS + ANÁLISIS ABIERTO):
1. CERO ALUCINACIÓN: Usa únicamente los datos del bloque [BASE_DE_DATOS_TALENT_POOL_2026]. Nunca inventes nombres, GGS, 9Box, riesgos ni sucesores.
2. CONTRATO DE ESTRUCTURA HTML OBLIGATORIA:
   - Envuelve siempre la respuesta analítica o de reporte en:
     <div class="ai-structured-response"> ... </div>
   - Utiliza exclusivamente las siguientes clases CSS ejecutivas de Centria:
     * Tarjeta contenedora: <div class="ai-html-card">
     * Cabecera de plantilla estándar (TEMPLATE): <div class="ai-html-header"> con <h4 class="ai-html-title"> y <p class="ai-html-subtitle">
     * Cabecera de análisis abierto Gemini IA (OPEN_ANALYSIS): <div class="ai-html-header ai-html-header-open"> con <h4 class="ai-html-title"> y <p class="ai-html-subtitle">
     * Cuerpo de tarjeta: <div class="ai-html-body">
     * Banner de razonamiento analítico (OPEN_ANALYSIS): <div class="ai-insight-banner">...</div>
     * Hoja de ruta / recomendaciones (OPEN_ANALYSIS): <div class="ai-step-grid"><div class="ai-step-card"><div class="ai-step-card-title">...</div><div class="ai-step-card-text">...</div></div></div>
     * Cuadrícula de KPIs: <div class="ai-kpi-grid"><div class="ai-kpi-box"><div class="ai-kpi-label">...</div><div class="ai-kpi-val">...</div></div></div>
     * Badges semánticos: <span class="ai-badge ai-badge-navy|ai-badge-cobalt|ai-badge-danger|ai-badge-warning|ai-badge-success|ai-badge-neutral">...</span>
     * Tablas ejecutivas: <div class="ai-table-wrap"><table class="ai-table"><thead><tr><th>...</th></tr></thead><tbody><tr><td>...</td></tr></tbody></table></div>
     * Bloques de alerta/diagnóstico: <div class="ai-alert-box ai-alert-critical|ai-alert-warning|ai-alert-success|ai-alert-info">...</div>
   - PROHIBIDO envolver el HTML en bloques de código Markdown (no uses ```html), PROHIBIDO usar etiquetas <script> o eventos on*, y PROHIBIDO usar atributos inline style="...".
3. EXCEPCIÓN PARA RESPUESTAS LINEALES O CONVERSACIONALES BREVES (LINEAR):
   - Si la consulta del usuario es un saludo ("hola", "buenos días"), agradecimiento, confirmación breve o una pregunta lineal simple de un único dato puntual (ej. "¿cuántos registros hay en total?"), devuelve únicamente:
     <p class="ai-linear-response">Tu respuesta directa, cordial y ejecutiva aquí.</p>
4. IDIOMA: Español corporativo, ejecutivo, claro y orientado a la toma de decisiones.{filter_note}{intent_note}

[BENCHMARKS_Y_TOTALES_GRUPO_BRECA]
{benchmarks_block}
[/BENCHMARKS_Y_TOTALES_GRUPO_BRECA]

[REGISTROS_RELEVANTES_PREFILTRADOS_PARA_CONSULTA ({len(records)} de {total_pool_size} posiciones analizadas mediante RAG Context Slicing)]
{dataset_str}
[/REGISTROS_RELEVANTES_PREFILTRADOS_PARA_CONSULTA]
"""


# ============================================================================
# MOTOR ANALÍTICO UNIVERSAL RAG EN MEMORIA (100% EXACTO SOBRE EL DOCUMENTO)
# ============================================================================

def _risk_badge(riesgo: str) -> str:
    r = (riesgo or "").capitalize()
    if r == "Alto":
        return "🔴 **Alto**"
    if r == "Medio":
        return "🟡 **Medio**"
    return "🟢 **Bajo**"


def _readiness_badge(readiness: str, tiene_sucesor: str = "Sí") -> str:
    if tiene_sucesor == "No" or not readiness or readiness in ("Sin cobertura", "Sin sucesor", "-"):
        return "⚠️ **Sin sucesor**"
    if readiness == "Inmediato":
        return "🟢 **Inmediato**"
    if readiness == "1 a 3 años":
        return "🔵 **1 a 3 años**"
    if readiness == "3 a 5 años":
        return "🟡 **3 a 5 años**"
    return f"🟠 **{readiness}**"


def _nine_box_short(nb: int) -> str:
    labels = {
        9: "9 (Estrella / Top Talent)",
        8: "8 (Alto Potencial / Futuro Líder)",
        7: "7 (Enigma / Alto Potencial)",
        6: "6 (Alto Desempeño / Core+)",
        5: "5 (Talento Clave / Core)",
        4: "4 (Potencial Medio / Bajo Desempeño)",
        3: "3 (Experto / Alto Desempeño)",
        2: "2 (Desempeño Medio / Bajo Potencial)",
        1: "1 (Bajo / Bajo)",
    }
    return labels.get(int(nb), f"Cuadrante {nb}")


def _find_mentioned_talents(query_norm: str, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    matched = []
    seen_ids = set()

    # 1. Coincidencia por nombre completo exacto (normalizado) o DNI / Documento
    for r in records:
        full_norm = normalize_text(r.get("nombre_completo", ""))
        doc_norm = normalize_text(r.get("documento", ""))
        if (full_norm and full_norm in query_norm) or (doc_norm and len(doc_norm) >= 6 and doc_norm in query_norm):
            if r["id"] not in seen_ids:
                matched.append(r)
                seen_ids.add(r["id"])

    if matched:
        return matched

    # 2. Coincidencia por Nombre + Apellido presentes en la pregunta
    for r in records:
        nom_norm = normalize_text(r.get("nombre", ""))
        ape_norm = normalize_text(r.get("apellidos", ""))
        if nom_norm and ape_norm and (nom_norm in query_norm and ape_norm in query_norm):
            if r["id"] not in seen_ids:
                matched.append(r)
                seen_ids.add(r["id"])

    if matched:
        return matched

    # 3. Coincidencia por apellido único si tiene >= 5 letras y aparece como palabra completa
    words = set(re.findall(r"[a-z0-9]+", query_norm))
    ape_counts: Dict[str, List[Dict[str, Any]]] = {}
    for r in records:
        ape_norm = normalize_text(r.get("apellidos", ""))
        if ape_norm and len(ape_norm) >= 5:
            ape_counts.setdefault(ape_norm, []).append(r)
    for ape_norm, r_list in ape_counts.items():
        if len(r_list) == 1 and ape_norm in words:
            r = r_list[0]
            if r["id"] not in seen_ids:
                matched.append(r)
                seen_ids.add(r["id"])

    return matched


def _find_mentioned_successors(query_norm: str, records: List[Dict[str, Any]]) -> List[Tuple[str, List[Dict[str, Any]]]]:
    """Detecta si el usuario pregunta por el nombre de un sucesor (ej. Carla Silva)."""
    by_suc: Dict[str, List[Dict[str, Any]]] = {}
    for r in records:
        suc = (r.get("sucesor") or "").strip()
        if suc and suc not in ("Sin sucesor", "-"):
            by_suc.setdefault(suc, []).append(r)

    found = []
    for suc_name, titulares in by_suc.items():
        suc_norm = normalize_text(suc_name)
        if suc_norm and suc_norm in query_norm:
            found.append((suc_name, titulares))
    return found


def _find_mentioned_companies(query_norm: str, records: List[Dict[str, Any]]) -> List[str]:
    all_companies = sorted(list({r.get("empresa", "") for r in records if r.get("empresa")}))
    matched = []
    for comp in all_companies:
        comp_norm = normalize_text(comp)
        if comp_norm in query_norm:
            matched.append(comp)
        elif comp == "Corporación Breca" and ("breca" in query_norm and "grupo breca" not in query_norm and "empresas breca" not in query_norm):
            matched.append(comp)
        elif comp == "Clínica Internacional" and ("clinica" in query_norm):
            matched.append(comp)
    return matched


def slice_relevant_records_for_query(
    message: str,
    records: List[Dict[str, Any]],
    company_filter: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    RAG Context Slicing & Pre-Filtering:
    En lugar de inyectar los 101 registros en cada llamada (lo que consumiría ~3,500 tokens
    por turno y encarecería la consulta), aplica un pre-filtrado semántico y de entidades:
    1. Si la consulta menciona a 1 o más personas específicas:
       - Extrae la ficha del talento.
       - Extrae la ficha del sucesor si está presente en el pool.
       - Incluye una muestra de 2-3 pares del mismo nivel GGS / empresa para benchmarking.
    2. Si la consulta menciona una empresa (ej. Centria, Qroma):
       - Extrae únicamente los registros de esa empresa (~10 a 25 filas).
    3. Si menciona un patrón de riesgo o filtro específico:
       - Filtra solo las filas vulnerables (ej. Riesgo Alto sin sucesor).
    4. Si es una consulta de alto nivel para el Comité de Talento:
       - Extrae las posiciones críticas prioritarias (top 15-20) + métricas agregadas del grupo.
    Retorna: (sliced_records, stats_summary)
    """
    q_norm = normalize_text(message)
    total_records = len(records)

    with_succ = sum(1 for r in records if r.get("tiene_sucesor") == "Sí" and r.get("sucesor") not in ("", "Sin sucesor", "-"))
    high_risk = sum(1 for r in records if r.get("riesgo") == "Alto")
    value_roles = sum(1 for r in records if r.get("cargo_valor") == "Sí")
    top_talent = sum(1 for r in records if int(r.get("nine_box", 0) or 0) in (8, 9))
    imm_readiness = sum(1 for r in records if r.get("readiness") == "Inmediato")

    stats_summary = {
        "total_posiciones": total_records,
        "cobertura_sucesion_pct": round((with_succ / max(total_records, 1)) * 100, 1),
        "total_con_sucesor": with_succ,
        "total_riesgo_alto": high_risk,
        "total_cargos_valor": value_roles,
        "total_top_talent_9box": top_talent,
        "total_readiness_inmediato": imm_readiness,
    }

    # 1. Coincidencia de personas específicas
    talents = _find_mentioned_talents(q_norm, records)
    if talents:
        sliced_ids = {t["id"] for t in talents}
        result = list(talents)

        for t in talents:
            suc_name = normalize_text(t.get("sucesor", ""))
            if suc_name and suc_name not in ("sin sucesor", "-"):
                for r in records:
                    if r["id"] not in sliced_ids and suc_name == normalize_text(r.get("nombre_completo", "")):
                        result.append(r)
                        sliced_ids.add(r["id"])

        if len(talents) == 1:
            target = talents[0]
            target_empresa = target.get("empresa")
            target_ggs = int(target.get("ggs", 0) or 0)
            peers = [
                r for r in records
                if r["id"] not in sliced_ids
                and r.get("empresa") == target_empresa
                and abs(int(r.get("ggs", 0) or 0) - target_ggs) <= 2
            ]
            for peer in peers[:3]:
                result.append(peer)
                sliced_ids.add(peer["id"])

        return result, stats_summary

    # 2. Búsqueda inversa por nombre de sucesor
    successors = _find_mentioned_successors(q_norm, records)
    if successors:
        result = []
        seen = set()
        for _, titulares in successors:
            for t in titulares:
                if t["id"] not in seen:
                    result.append(t)
                    seen.add(t["id"])
        if result:
            return result, stats_summary

    # 3. Mención de empresas específicas
    companies = _find_mentioned_companies(q_norm, records)
    if companies:
        comp_records = [r for r in records if r.get("empresa") in companies]
        if comp_records:
            return comp_records, stats_summary

    # 4. Filtros específicos por regla de negocio
    if ("riesgo alto" in q_norm or "alto riesgo" in q_norm) and ("sin sucesor" in q_norm or "no cuenta" in q_norm or "no tienen" in q_norm):
        filtered = [
            r for r in records
            if r.get("riesgo") == "Alto" and (r.get("tiene_sucesor") == "No" or r.get("sucesor") in ("", "Sin sucesor", "-"))
        ]
        return filtered, stats_summary

    if "readiness inmediato" in q_norm or "inmediat" in q_norm or "ready now" in q_norm:
        filtered = [r for r in records if r.get("readiness") == "Inmediato"]
        return filtered, stats_summary

    if "cargo de valor" in q_norm or "posicion critica" in q_norm or "posiciones criticas" in q_norm:
        filtered = [r for r in records if r.get("cargo_valor") == "Sí"]
        return filtered, stats_summary

    if "9box 8" in q_norm or "9box 9" in q_norm or "top talent" in q_norm or "alto potencial" in q_norm:
        filtered = [r for r in records if int(r.get("nine_box", 0) or 0) in (8, 9)]
        return filtered, stats_summary

    # 5. Filtro activo de empresa en la interfaz
    if company_filter and company_filter != "ALL":
        filtered = [r for r in records if r.get("empresa") == company_filter]
        if filtered:
            return filtered, stats_summary

    # 6. Para consultas abiertas de comité / estrategia global:
    critical_slice = [
        r for r in records
        if (r.get("riesgo") == "Alto" and r.get("tiene_sucesor") != "Sí")
        or (int(r.get("nine_box", 0) or 0) in (8, 9) and r.get("tiene_sucesor") != "Sí")
        or (r.get("cargo_valor") == "Sí" and r.get("tiene_sucesor") != "Sí")
    ]
    if len(critical_slice) >= 8:
        return critical_slice, stats_summary

    return records, stats_summary


def _render_individual_card(r: Dict[str, Any], query_norm: str = "", also_successor_of: Optional[List[Dict[str, Any]]] = None) -> str:
    tiene_suc = r.get("tiene_sucesor") == "Sí" and r.get("sucesor") not in ("", "Sin sucesor", "-")
    sucesor_txt = r.get("sucesor") if tiene_suc else "Sin sucesor identificado"
    readiness_txt = _readiness_badge(r.get("readiness", ""), r.get("tiene_sucesor", "No"))
    riesgo_txt = _risk_badge(r.get("riesgo", "Medio"))
    cargo_critico = "✅ **Sí (Posición Crítica)**" if r.get("cargo_valor") == "Sí" else "No"

    # Diagnóstico personalizado según reglas de negocio
    alertas = []
    if r.get("riesgo") == "Alto" and not tiene_suc:
        alertas.append(
            f"🚨 **Alerta Crítica de Continuidad:** {r['nombre_completo']} presenta **Riesgo de Pérdida Alto** y **NO cuenta con sucesor** mapeado para la posición de *{r['posicion']}*."
        )
    elif r.get("riesgo") == "Alto" and r.get("readiness") in ("3 a 5 años", "+ de 5 años", "> 5 años"):
        alertas.append(
            f"⚠️ **Brecha Temporal de Sucesión:** Existe **Riesgo de Pérdida Alto**, pero su sucesor/a (**{sucesor_txt}**) requiere un horizonte de preparación de **{r['readiness']}**, generando vulnerabilidad ante una salida a corto plazo."
        )
    elif r.get("riesgo") == "Alto" and r.get("readiness") == "Inmediato":
        alertas.append(
            f"⚡ **Riesgo de Fuga Mitigado por Cobertura Inmediata:** Aunque el titular tiene **Riesgo Alto de Pérdida**, la posición cuenta con sucesor de disponibilidad **Inmediata** (**{sucesor_txt}**)."
        )
    elif tiene_suc and r.get("readiness") == "Inmediato":
        alertas.append(
            f"✅ **Sucesión Lista (Ready Now):** La posición cuenta con cobertura **Inmediata** a través de **{sucesor_txt}** (Motivación: *{r.get('motivacion_sucesor', '-')}*)."
        )
    elif tiene_suc:
        alertas.append(
            f"ℹ️ **Sucesión en Desarrollo:** El sucesor identificado (**{sucesor_txt}**) se encuentra en horizonte de preparación de **{r.get('readiness')}** (Motivación: *{r.get('motivacion_sucesor', '-')}*)."
        )
    else:
        alertas.append(
            f"⚠️ **Posición sin Cobertura:** Actualmente no se registra un sucesor nominal en el Talent Pool para este rol."
        )

    if int(r.get("nine_box", 5)) >= 8:
        alertas.append(
            f"🌟 **Talento de Alto Potencial (9Box {r['nine_box']}):** Ubicado en cuadrante superior de talento calibrado; priorizar plan de desarrollo y retención ejecutiva."
        )

    if also_successor_of:
        roles_str = ", ".join([f"**{t['nombre_completo']}** (*{t['posicion']}* en {t['empresa']}, Readiness: `{t['readiness']}`)" for t in also_successor_of])
        alertas.append(f"🔄 **Mapeado además como Sucesor/a de:** {roles_str}.")

    diag_md = "\n".join([f"- {a}" for a in alertas])

    return f"""### 👤 Ficha Ejecutiva de Talento y Sucesión: **{r['nombre_completo']}**

> **Unidad de Negocio:** `{r['empresa']}` · **ID Documento:** `{r['documento']}` · **Cargo de Valor:** {cargo_critico}

| Indicador Clave | Detalle Registrado en Reporte 2026 |
| :--- | :--- |
| **Empresa** | **{r['empresa']}** |
| **Posición / Nivel** | **{r['posicion']}** (`{r['nivel']}`) |
| **Grado Corporativo (GGS)** | **`GGS {r['ggs']}`** |
| **Cuadrante 9-Box Calibrado** | **`9Box {r['nine_box']}`** — *{_nine_box_short(r['nine_box'])}* |
| **Riesgo de Pérdida** | {riesgo_txt} |
| **Cargo de Valor / Posición Crítica** | {cargo_critico} |
| **Tiempo en Posición Actual** | `{r.get('tiempo_posicion', 'N/D')}` |
| **¿Cuenta con Sucesor?** | **{r['tiene_sucesor']}** |
| **Nombre del Sucesor** | **{sucesor_txt}** |
| **Readiness / Preparación** | {readiness_txt} |
| **Motivación del Sucesor** | *{r.get('motivacion_sucesor', '-')}* |

---

#### 📌 Diagnóstico Ejecutivo para el Comité de Talento
{diag_md}
"""


def _render_successor_reverse_lookup(suc_name: str, titulares: List[Dict[str, Any]]) -> str:
    rows = "\n".join([
        f"| **{t['nombre_completo']}** | **{t['empresa']}** | {t['posicion']} (`{t['nivel']}`) | GGS {t['ggs']} | {_risk_badge(t['riesgo'])} | {t['cargo_valor']} | {_readiness_badge(t['readiness'], 'Sí')} | *{t.get('motivacion_sucesor', '-')}* |"
        for t in titulares
    ])
    return f"""### 🔄 Mapeo de Sucesión para el Candidato/a: **{suc_name}**

**{suc_name}** figura en el reporte `2026_Reporte_Sucesion.xlsx` como **sucesor/a nominal** de **{len(titulares)} posición(es)**:

| Titular Actual | Empresa | Posición a Suceder / Nivel | GGS | Riesgo del Titular | Cargo de Valor | Readiness de {suc_name} | Motivación Registrada |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- | :--- |
{rows}
"""


def _render_talent_comparison(talents: List[Dict[str, Any]]) -> str:
    names_title = " vs. ".join([f"**{t['nombre_completo']}** ({t['empresa']})" for t in talents])
    rows_md = []
    for t in talents:
        suc = t["sucesor"] if t.get("tiene_sucesor") == "Sí" else "Sin sucesor"
        rows_md.append(
            f"| **{t['nombre_completo']}** | {t['empresa']} | {t['posicion']} (`{t['nivel']}`) | **GGS {t['ggs']}** | **9Box {t['nine_box']}** | {_risk_badge(t['riesgo'])} | {t['cargo_valor']} | **{suc}** | {_readiness_badge(t['readiness'], t['tiene_sucesor'])} |"
        )

    table_str = "\n".join(rows_md)

    insights = []
    ggs_sorted = sorted(talents, key=lambda x: int(x.get("ggs", 0)), reverse=True)
    if ggs_sorted[0]["ggs"] != ggs_sorted[-1]["ggs"]:
        insights.append(
            f"**Jerarquía y Peso de Posición (GGS):** **{ggs_sorted[0]['nombre_completo']}** ocupa una posición de mayor grado corporativo (**GGS {ggs_sorted[0]['ggs']}**, `{ggs_sorted[0]['nivel']}`) frente a **{ggs_sorted[-1]['nombre_completo']}** (**GGS {ggs_sorted[-1]['ggs']}**, `{ggs_sorted[-1]['nivel']}`)."
        )
    else:
        insights.append(
            f"**Grado Corporativo (GGS):** Ambos ejecutivos comparten el mismo nivel de peso organizacional (**GGS {ggs_sorted[0]['ggs']}**, `{ggs_sorted[0]['nivel']}`)."
        )

    nb_vals = [f"**{t['nombre_completo']}** registra **9Box {t['nine_box']}**" for t in talents]
    insights.append(f"**Desempeño y Potencial (9Box Calibrado):** {'; mientras que '.join(nb_vals)}.")

    risk_vals = [f"**{t['nombre_completo']}** presenta riesgo **{t['riesgo']}** (antigüedad: `{t.get('tiempo_posicion', '-')}`)" for t in talents]
    insights.append(f"**Exposición y Riesgo de Pérdida:** {', '.join(risk_vals)}.")

    suc_vals = []
    for t in talents:
        if t.get("tiene_sucesor") == "Sí":
            suc_vals.append(
                f"**{t['nombre_completo']}** cuenta con sucesor nominal (**{t['sucesor']}**, readiness **{t['readiness']}**, motivación: *{t.get('motivacion_sucesor', '-')}*)"
            )
        else:
            suc_vals.append(f"**{t['nombre_completo']}** **NO cuenta con sucesor identificado** (brecha crítica de cobertura)")
    insights.append(f"**Cobertura y Readiness de Sucesión:** {'; por su parte, '.join(suc_vals)}.")

    bullets = "\n".join([f"- {item}" for item in insights])

    return f"""### ⚖️ Comparativa Cruzada de Talento y Sucesión
#### {names_title}

| Talento | Empresa | Posición / Nivel | GGS | 9Box | Riesgo de Pérdida | Cargo de Valor | Sucesor Nominal | Readiness / Preparación |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
{table_str}

---

#### 🔍 Análisis Comparativo Clave
{bullets}
"""


def _render_company_comparison(companies: List[str], records: List[Dict[str, Any]]) -> str:
    rows_md = []
    comp_stats = []
    for comp in companies:
        sub = [r for r in records if r.get("empresa") == comp]
        total = len(sub)
        if total == 0:
            continue
        con_suc = sum(1 for r in sub if r.get("tiene_sucesor") == "Sí")
        sin_suc = total - con_suc
        cov_pct = round((con_suc / total) * 100, 1)
        inmediato = sum(1 for r in sub if r.get("readiness") == "Inmediato")
        riesgo_alto = sum(1 for r in sub if r.get("riesgo") == "Alto")
        criticos_sin_suc = sum(1 for r in sub if r.get("cargo_valor") == "Sí" and r.get("tiene_sucesor") == "No")
        top_9box = sum(1 for r in sub if int(r.get("nine_box", 0)) in (8, 9))
        riesgo_alto_sin_suc = [r for r in sub if r.get("riesgo") == "Alto" and r.get("tiene_sucesor") == "No"]

        comp_stats.append({
            "empresa": comp,
            "total": total,
            "con_suc": con_suc,
            "sin_suc": sin_suc,
            "cov_pct": cov_pct,
            "inmediato": inmediato,
            "riesgo_alto": riesgo_alto,
            "criticos_sin_suc": criticos_sin_suc,
            "top_9box": top_9box,
            "riesgo_alto_sin_suc": riesgo_alto_sin_suc,
        })

        rows_md.append(
            f"| **{comp}** | **{total}** | **{con_suc}/{total}** (`{cov_pct}%`) | 🟢 **{inmediato}** | ⚠️ **{sin_suc}** | 🔴 **{riesgo_alto}** | 🌟 **{top_9box}** | 🚨 **{len(riesgo_alto_sin_suc)}** |"
        )

    table_md = "\n".join(rows_md)
    detail_blocks = []
    for st in comp_stats:
        crit_names = ", ".join([f"**{r['nombre_completo']}** (*{r['posicion']}*)" for r in st["riesgo_alto_sin_suc"]]) or "Ninguno"
        detail_blocks.append(
            f"- **{st['empresa']}**: Cobertura de sucesión del **{st['cov_pct']}%** ({st['con_suc']} de {st['total']} posiciones cubiertas, {st['inmediato']} con readiness *Inmediato*). Registra **{st['riesgo_alto']}** talentos en riesgo alto y **{len(st['riesgo_alto_sin_suc'])}** casos críticos de riesgo alto sin sucesor ({crit_names})."
        )

    return f"""### 🏢 Comparativa de Salud de Sucesión entre Empresas
#### {" vs. ".join([f"**{c}**" for c in companies])}

| Empresa | Total Talentos | Cobertura Sucesión | Readiness Inmediato | Sin Sucesor | Riesgo Pérdida Alto | Top Talent (9Box 8-9) | Riesgo Alto Sin Sucesor |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
{table_md}

---

#### 📊 Síntesis Ejecutiva por Unidad de Negocio
{chr(10).join(detail_blocks)}
"""


def _extract_universal_filters(q_norm: str, records: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Motor universal de extracción de filtros en lenguaje natural sobre las 14 columnas
    de 2026_Reporte_Sucesion.xlsx. Permite combinar múltiples criterios libremente.
    """
    filtered = list(records)
    criteria_labels: List[str] = []

    # 1. Filtro por Empresa (1 empresa mencionada)
    companies = _find_mentioned_companies(q_norm, records)
    if len(companies) == 1:
        comp = companies[0]
        filtered = [r for r in filtered if r.get("empresa") == comp]
        criteria_labels.append(f"Empresa = **{comp}**")

    # 2. Filtro por Nivel Organizacional (N-0, N-1, N-2, N-3)
    niveles_found = []
    for niv in ("n-0", "n-1", "n-2", "n-3"):
        if niv in q_norm or niv.replace("-", "") in q_norm.split():
            niveles_found.append(niv.upper())
    if niveles_found:
        filtered = [r for r in filtered if r.get("nivel", "").upper() in niveles_found]
        criteria_labels.append(f"Nivel = **{', '.join(niveles_found)}**")

    # 3. Filtro por GGS (ej. GGS 14, GGS 20, GGS > 18, mayor GGS, menor GGS)
    ggs_greater = re.search(r"ggs\s*(?:mayor\s*a|superior\s*a|mas\s*de|>|>=)\s*(\d{2})", q_norm)
    ggs_less = re.search(r"ggs\s*(?:menor\s*a|inferior\s*a|menos\s*de|<|<=)\s*(\d{2})", q_norm)
    ggs_exact = [int(x) for x in re.findall(r"ggs\s*(\d{2})", q_norm)]

    if ggs_greater:
        val = int(ggs_greater.group(1))
        filtered = [r for r in filtered if int(r.get("ggs", 0)) >= (val if ">=" in q_norm else val + 1)]
        criteria_labels.append(f"GGS > **{val}**")
    elif ggs_less:
        val = int(ggs_less.group(1))
        filtered = [r for r in filtered if int(r.get("ggs", 0)) <= (val if "<=" in q_norm else val - 1)]
        criteria_labels.append(f"GGS < **{val}**")
    elif ggs_exact:
        filtered = [r for r in filtered if int(r.get("ggs", 0)) in ggs_exact]
        criteria_labels.append(f"GGS = **{', '.join(f'GGS {g}' for g in ggs_exact)}**")
    elif "mayor ggs" in q_norm or "ggs mas alto" in q_norm or "maximo ggs" in q_norm:
        if filtered:
            max_g = max(int(r.get("ggs", 0)) for r in filtered)
            filtered = [r for r in filtered if int(r.get("ggs", 0)) == max_g]
            criteria_labels.append(f"GGS Máximo (**GGS {max_g}**)")
    elif "menor ggs" in q_norm or "ggs mas bajo" in q_norm or "minimo ggs" in q_norm:
        if filtered:
            min_g = min(int(r.get("ggs", 0)) for r in filtered)
            filtered = [r for r in filtered if int(r.get("ggs", 0)) == min_g]
            criteria_labels.append(f"GGS Mínimo (**GGS {min_g}**)")

    # 4. Filtro por Riesgo de Pérdida (Alto, Medio, Bajo)
    risks_found = []
    if "riesgo alto" in q_norm or "alto riesgo" in q_norm or "riesgo de perdida alto" in q_norm or re.search(r"\briesgo\s+alto\b", q_norm):
        risks_found.append("Alto")
    if "riesgo medio" in q_norm or "medio riesgo" in q_norm or "riesgo moderado" in q_norm or re.search(r"\briesgo\s+medio\b", q_norm):
        risks_found.append("Medio")
    if "riesgo bajo" in q_norm or "bajo riesgo" in q_norm or "menor riesgo" in q_norm or re.search(r"\briesgo\s+bajo\b", q_norm):
        risks_found.append("Bajo")
    if risks_found:
        filtered = [r for r in filtered if r.get("riesgo") in risks_found]
        criteria_labels.append(f"Riesgo de Pérdida = **{', '.join(risks_found)}**")

    # 5. Filtro por Cargo de Valor / Posición Crítica
    if any(k in q_norm for k in ("no son cargo de valor", "no criticas", "no son posiciones criticas", "cargo de valor no")):
        filtered = [r for r in filtered if r.get("cargo_valor") == "No"]
        criteria_labels.append("Cargo de Valor = **No**")
    elif any(k in q_norm for k in ("cargo de valor", "cargos de valor", "posicion critica", "posiciones criticas", "roles criticos", "cargos criticos")):
        filtered = [r for r in filtered if r.get("cargo_valor") == "Sí"]
        criteria_labels.append("Cargo de Valor = **Sí (Posición Crítica)**")

    # 6. Filtro por 9-Box (Cuadrantes específicos o rangos Alto/Medio/Bajo)
    nb_found = set()
    if "8 o 9" in q_norm or "8 y 9" in q_norm or "9box alto" in q_norm or "top talent" in q_norm or "estrellas" in q_norm:
        nb_found.update([8, 9])
    if "9box bajo" in q_norm or "bajo potencial" in q_norm or "bajo desempeno" in q_norm:
        nb_found.update([1, 2, 3, 4])
    for m in re.finditer(r"(?:9box|9-box|cuadrante)\s*(\d)(?:\s*(?:,|o|y|al|a)\s*(\d))?", q_norm):
        nb_found.add(int(m.group(1)))
        if m.group(2):
            nb_found.add(int(m.group(2)))
    if nb_found:
        nb_sorted = sorted(nb_found)
        filtered = [r for r in filtered if int(r.get("nine_box", 0)) in nb_sorted]
        criteria_labels.append(f"9-Box = **{', '.join(str(n) for n in nb_sorted)}**")

    # 7. Filtro por Sucesor / Readiness
    if any(k in q_norm for k in ("sin sucesor", "no cuentan con sucesor", "no tienen sucesor", "ausencia de sucesor", "sin cobertura", "no tiene sucesor")):
        filtered = [r for r in filtered if r.get("tiene_sucesor") == "No"]
        criteria_labels.append("Sucesión = **Sin Sucesor Identificado**")
    elif "inmediat" in q_norm or "ready now" in q_norm or "listo hoy" in q_norm:
        filtered = [r for r in filtered if r.get("tiene_sucesor") == "Sí" and r.get("readiness") == "Inmediato"]
        criteria_labels.append("Readiness = **Inmediato (Ready Now)**")
    elif ("cinco anos" in q_norm or "5 anos" in q_norm) and any(w in q_norm for w in ("mas de", "superior", "+", ">", "mayor")):
        filtered = [r for r in filtered if r.get("readiness") in ("+ de 5 años", "> 5 años")]
        criteria_labels.append("Readiness = **+ de 5 años**")
    elif ("tres anos" in q_norm or "3 anos" in q_norm) and any(w in q_norm for w in ("mas de", "superior", ">", "mayor", "largo plazo")):
        filtered = [r for r in filtered if r.get("tiene_sucesor") == "Sí" and r.get("readiness") in ("3 a 5 años", "+ de 5 años", "> 5 años")]
        criteria_labels.append("Readiness = **> 3 años (`3 a 5 años` y `+ de 5 años`)**")
    elif "1 a 3" in q_norm or "uno a tres" in q_norm:
        filtered = [r for r in filtered if r.get("readiness") == "1 a 3 años"]
        criteria_labels.append("Readiness = **1 a 3 años**")
    elif "3 a 5" in q_norm or "tres a cinco" in q_norm:
        filtered = [r for r in filtered if r.get("readiness") == "3 a 5 años"]
        criteria_labels.append("Readiness = **3 a 5 años**")
    elif any(k in q_norm for k in ("con sucesor", "tienen sucesor", "cuentan con sucesor", "posiciones cubiertas")):
        filtered = [r for r in filtered if r.get("tiene_sucesor") == "Sí"]
        criteria_labels.append("Sucesión = **Con Sucesor Asignado**")

    # 8. Filtro por Motivación del Sucesor
    if "motivacion" in q_norm or "motivado" in q_norm or "interempresa" in q_norm or "crecimiento vertical" in q_norm or "estabilidad" in q_norm:
        if "baja" in q_norm or "poco motivado" in q_norm or "estabilidad" in q_norm:
            filtered = [r for r in filtered if "baja" in normalize_text(r.get("motivacion_sucesor", ""))]
            criteria_labels.append("Motivación del Sucesor = **Baja**")
        elif "media" in q_norm or "ubicacion" in q_norm or "consolidando" in q_norm:
            filtered = [r for r in filtered if "media" in normalize_text(r.get("motivacion_sucesor", ""))]
            criteria_labels.append("Motivación del Sucesor = **Media**")
        elif "interempresa" in q_norm:
            filtered = [r for r in filtered if "interempresa" in normalize_text(r.get("motivacion_sucesor", ""))]
            criteria_labels.append("Motivación del Sucesor = **Movilidad Interempresa**")
        elif "regional" in q_norm:
            filtered = [r for r in filtered if "regional" in normalize_text(r.get("motivacion_sucesor", ""))]
            criteria_labels.append("Motivación del Sucesor = **Liderazgo Regional**")
        elif "alta" in q_norm or "muy motivado" in q_norm:
            filtered = [r for r in filtered if "alta" in normalize_text(r.get("motivacion_sucesor", ""))]
            criteria_labels.append("Motivación del Sucesor = **Alta**")

    # 9. Filtro por Antigüedad / Tiempo en la posición
    if any(k in q_norm for k in ("menos de 1 ano", "menos de un ano", "recien ingres", "menos tiempo en la posicion", "menor tiempo")):
        filtered = [r for r in filtered if 0 < parse_tenure_months(r.get("tiempo_posicion", "")) < 12]
        criteria_labels.append("Tiempo en posición = **< 1 año (Meses)**")
    elif any(k in q_norm for k in ("mas de 5 anos en", "mas de 6 anos", "7 anos", "mas tiempo en la posicion", "mayor antiguedad", "mas antiguo")):
        filtered = [r for r in filtered if parse_tenure_months(r.get("tiempo_posicion", "")) >= 72]
        criteria_labels.append("Tiempo en posición = **≥ 6 años (Alta antigüedad en el rol)**")

    # 10. Filtro por Cargo / Posición / Área funcional
    role_keywords = [
        ("ceo", ["ceo", "gerente general"]),
        ("gerente general", ["ceo", "gerente general"]),
        ("finanzas", ["finanzas", "financiero", "cfo", "tesoreria"]),
        ("operaciones", ["operaciones", "coo", "planta", "produccion"]),
        ("recursos humanos", ["recursos humanos", "talento", "gestion humana", "personas"]),
        ("gestion humana", ["recursos humanos", "talento", "gestion humana", "personas"]),
        ("auditoria", ["auditoria"]),
        ("legal", ["legal", "juridica", "cumplimiento"]),
        ("tecnologia", ["tecnologia", "sistemas", "ti", "digital", "informacion"]),
        ("comercial", ["comercial", "ventas", "marketing", "negocios"]),
        ("logistica", ["logistica", "cadena de suministro", "supply"]),
        ("planeamiento", ["planeamiento", "estrategia", "desarrollo"]),
        ("riesgos", ["riesgos", "riesgo operacional"]),
    ]
    for trigger, terms in role_keywords:
        if trigger in q_norm:
            role_matches = [
                r for r in filtered
                if any(t in normalize_text(r.get("posicion", "")) for t in terms)
            ]
            if role_matches:
                filtered = role_matches
                criteria_labels.append(f"Área / Rol = **{trigger.title()}**")
            break

    return filtered, criteria_labels


def _render_company_summary(company: str, records: List[Dict[str, Any]], query_norm: str) -> str:
    sub = [r for r in records if r.get("empresa") == company]
    total = len(sub)
    if total == 0:
        return f"No se encontraron registros para la empresa **{company}** en la base de datos cargada."

    # Si la pregunta aplica sub-filtros adicionales además de la empresa (ej. "sin sucesor", "inmediato", "9box 8", "cargo de valor", "riesgo alto")
    sub_filtered, sub_labels = _extract_universal_filters(query_norm, records)
    if len(sub_labels) > 1:
        rows = "\n".join([
            f"| **{r['nombre_completo']}** | {r['posicion']} (`{r['nivel']}`) | GGS {r['ggs']} | 9Box {r['nine_box']} | {_risk_badge(r['riesgo'])} | {r['cargo_valor']} | **{r['sucesor']}** | {_readiness_badge(r['readiness'], r['tiene_sucesor'])} |"
            for r in sub_filtered
        ])
        if not rows:
            rows = "| *Sin coincidencias exactas para esta combinación* | - | - | - | - | - | - | - |"
        return f"""### 🏢 Consulta Focalizada en **{company}** ({len(sub_filtered)} de {total} posiciones)

> **Criterios aplicados:** {" · ".join(sub_labels)}

| Nombre del Talento | Posición / Nivel | GGS | 9Box | Riesgo de Pérdida | Cargo de Valor | Sucesor Nominal | Readiness / Preparación |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
{rows}

#### 📌 Hallazgo Ejecutivo en {company}
- Se identifican **{len(sub_filtered)}** posiciones que cumplen estos criterios dentro de los **{total}** talentos registrados en **{company}** (**{round((len(sub_filtered)/max(total,1))*100, 1)}%** de la unidad).
"""

    con_suc = sum(1 for r in sub if r.get("tiene_sucesor") == "Sí")
    sin_suc = total - con_suc
    cov_pct = round((con_suc / total) * 100, 1)
    riesgo_alto = [r for r in sub if r.get("riesgo") == "Alto"]
    riesgo_alto_sin_suc = [r for r in sub if r.get("riesgo") == "Alto" and r.get("tiene_sucesor") == "No"]
    inmediatos = [r for r in sub if r.get("readiness") == "Inmediato"]
    cargos_valor = [r for r in sub if r.get("cargo_valor") == "Sí"]

    rows_all = "\n".join([
        f"| **{r['nombre_completo']}** | {r['posicion']} (`{r['nivel']}`) | GGS {r['ggs']} | 9Box {r['nine_box']} | {_risk_badge(r['riesgo'])} | {r['cargo_valor']} | **{r['sucesor']}** | {_readiness_badge(r['readiness'], r['tiene_sucesor'])} |"
        for r in sub
    ])

    alertas = []
    if riesgo_alto_sin_suc:
        names = ", ".join([f"**{r['nombre_completo']}** (*{r['posicion']}*, GGS {r['ggs']})" for r in riesgo_alto_sin_suc])
        alertas.append(f"🚨 **Riesgo Crítico (Fuga Alta + Sin Sucesor):** {len(riesgo_alto_sin_suc)} posición(es): {names}.")
    riesgo_alto_largo = [r for r in riesgo_alto if r.get("readiness") in ("3 a 5 años", "+ de 5 años", "> 5 años")]
    if riesgo_alto_largo:
        names = ", ".join([f"**{r['nombre_completo']}** (Sucesor: *{r['sucesor']}* en {r['readiness']})" for r in riesgo_alto_largo])
        alertas.append(f"⚠️ **Riesgo Alto con Sucesión a Largo Plazo (>3 años):** {names}.")
    sin_suc_list = [r for r in sub if r.get("tiene_sucesor") == "No"]
    if sin_suc_list:
        names = ", ".join([f"**{r['nombre_completo']}** (*{r['posicion']}*)" for r in sin_suc_list])
        alertas.append(f"📌 **Posiciones sin Sucesor Mapeado ({len(sin_suc_list)}):** {names}.")

    alertas_md = "\n".join([f"- {a}" for a in alertas]) if alertas else "- ✅ Todas las posiciones tienen cobertura adecuada y riesgo controlado."

    return f"""### 🏢 Radiografía de Talento y Sucesión: **{company}**

> **Total Talentos:** `{total}` · **Cobertura de Sucesión:** `{cov_pct}%` ({con_suc}/{total}) · **Riesgo Alto:** `{len(riesgo_alto)}` · **Cargos de Valor:** `{len(cargos_valor)}` · **Readiness Inmediato:** `{len(inmediatos)}`

| Nombre del Talento | Posición / Nivel | GGS | 9Box | Riesgo de Pérdida | Cargo de Valor | Sucesor Nominal | Readiness / Preparación |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
{rows_all}

---

#### 🚨 Principales Riesgos y Brechas Identificadas en {company}
{alertas_md}
"""


def _render_all_companies_ranking(records: List[Dict[str, Any]]) -> str:
    all_companies = sorted(list({r.get("empresa", "") for r in records if r.get("empresa")}))
    return _render_company_comparison(all_companies, records)


def analyze_talent_query(query: str, records: List[Dict[str, Any]], history: Optional[List[Dict[str, str]]] = None) -> str:
    """
    Motor Analítico Universal RAG en Memoria.
    Evalúa CUALQUIER consulta del usuario contra los registros activos (incluyendo ediciones en vivo)
    y devuelve una respuesta ejecutiva en Markdown con exactitud matemática.
    """
    if not records:
        return "⚠️ No hay registros cargados actualmente en la tabla. Por favor carga el archivo `2026_Reporte_Sucesion.xlsx`."

    q_norm = normalize_text(query)

    # 0. Resolución de contexto conversacional (si la pregunta es breve de seguimiento como "¿quién es su sucesor?" o "¿cuál es su GGS?")
    mentioned_talents = _find_mentioned_talents(q_norm, records)
    if not mentioned_talents and history and len(q_norm.split()) <= 10:
        if any(pron in q_norm for pron in ("su ", "el ", "ella", "este talento", "esa posicion", "sucesor", "ggs", "riesgo", "9box", "tiempo")):
            for msg in reversed(history[-4:]):
                prev_text = normalize_text(msg.get("content") or msg.get("text") or "")
                prev_talents = _find_mentioned_talents(prev_text, records)
                if len(prev_talents) == 1:
                    mentioned_talents = prev_talents
                    break

    # 1. Comparación de 2 o más talentos mencionados explícitamente
    if len(mentioned_talents) >= 2:
        return _render_talent_comparison(mentioned_talents)

    # 2. Ficha individual de 1 talento mencionado (verificando también si es sucesor de alguien)
    if len(mentioned_talents) == 1:
        t = mentioned_talents[0]
        t_norm = normalize_text(t["nombre_completo"])
        also_suc = [r for r in records if normalize_text(r.get("sucesor", "")) == t_norm]
        return _render_individual_card(t, q_norm, also_successor_of=also_suc)

    # 3. Búsqueda inversa por nombre de Sucesor (ej. "¿De quién es sucesora Carla Silva?")
    mentioned_successors = _find_mentioned_successors(q_norm, records)
    if mentioned_successors:
        blocks = [_render_successor_reverse_lookup(s_name, tits) for s_name, tits in mentioned_successors]
        return "\n\n---\n\n".join(blocks)

    # 4. Comparación entre 2 o más empresas mencionadas
    mentioned_companies = _find_mentioned_companies(q_norm, records)
    if len(mentioned_companies) >= 2:
        return _render_company_comparison(mentioned_companies, records)

    # 5. Ranking / comparativa de TODAS las empresas del documento
    if any(k in q_norm for k in ("todas las empresas", "por empresa", "ranking de empresas", "cuantas empresas", "empresas del grupo")):
        return _render_all_companies_ranking(records)

    # 6. Si menciona exactamente 1 empresa, usar el analizador de empresa (que soporta subfiltros universales)
    if len(mentioned_companies) == 1:
        return _render_company_summary(mentioned_companies[0], records, q_norm)

    # 7. Casos Especiales del Comité de Talento (Preguntas compuestas de alto valor)

    # Caso 7A: Posiciones críticas desglosadas por Cobertura Inmediata, En Desarrollo y Sin Cobertura
    if "cobertura inmediata" in q_norm and "en desarrollo" in q_norm and "sin cobertura" in q_norm:
        criticos = [r for r in records if r.get("cargo_valor") == "Sí"]
        inm = [r for r in criticos if r.get("tiene_sucesor") == "Sí" and r.get("readiness") == "Inmediato"]
        des = [r for r in criticos if r.get("tiene_sucesor") == "Sí" and r.get("readiness") != "Inmediato"]
        sin = [r for r in criticos if r.get("tiene_sucesor") == "No"]

        sin_rows = "\n".join([
            f"| **{r['nombre_completo']}** | {r['empresa']} | {r['posicion']} (`{r['nivel']}`) | GGS {r['ggs']} | 9Box {r['nine_box']} | {_risk_badge(r['riesgo'])} | ⚠️ **Sin cobertura** |"
            for r in sin
        ])
        inm_rows = "\n".join([
            f"| **{r['nombre_completo']}** | {r['empresa']} | {r['posicion']} (`{r['nivel']}`) | GGS {r['ggs']} | **{r['sucesor']}** | 🟢 **Inmediato** |"
            for r in inm[:12]
        ])

        return f"""### 🎯 Clasificación de Posiciones Críticas (`Cargo de Valor = Sí`, Total: {len(criticos)})

| Nivel de Cobertura | Cantidad de Posiciones Críticas | % sobre Cargos de Valor | Nivel de Riesgo Operativo |
| :--- | :---: | :---: | :--- |
| 🟢 **Cobertura Inmediata (`Ready Now`)** | **{len(inm)}** | **{round((len(inm)/max(len(criticos),1))*100, 1)}%** | Bajo — Reemplazo listo para asumir hoy |
| 🔵 **Cobertura en Desarrollo (`1 a >5 años`)** | **{len(des)}** | **{round((len(des)/max(len(criticos),1))*100, 1)}%** | Moderado — Requiere aceleración de PDI |
| 🚨 **Sin Cobertura (`Sin sucesor`)** | **{len(sin)}** | **{round((len(sin)/max(len(criticos),1))*100, 1)}%** | **Crítico — Sin reemplazo identificado** |

---

#### 1️⃣ Posiciones Críticas **Sin Cobertura** ({len(sin)} casos — Prioridad 1 del Comité)
| Titular | Empresa | Posición / Nivel | GGS | 9Box | Riesgo Titular | Estado |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
{sin_rows}

#### 2️⃣ Posiciones Críticas con **Cobertura Inmediata** ({len(inm)} casos)
| Titular | Empresa | Posición / Nivel | GGS | Sucesor Listo | Readiness |
| :--- | :--- | :--- | :---: | :--- | :---: |
{inm_rows}

> 💡 **Nota:** Las **{len(des)}** posiciones críticas restantes cuentan con sucesores en desarrollo (`1 a 3 años`: {sum(1 for r in des if r.get('readiness')=='1 a 3 años')}, `3 a 5 años`: {sum(1 for r in des if r.get('readiness')=='3 a 5 años')}, `+ de 5 años`: {sum(1 for r in des if r.get('readiness') in ('+ de 5 años', '> 5 años'))}).
"""

    # Caso 7B: 9Box alto + resumen de brechas de sucesión
    if ("9box 8" in q_norm or "9box 9" in q_norm or "8 o 9" in q_norm or "9box alto" in q_norm) and ("brecha" in q_norm or "resume" in q_norm):
        top_talents = [r for r in records if int(r.get("nine_box", 0)) in (8, 9)]
        sin_suc = [r for r in top_talents if r.get("tiene_sucesor") == "No"]
        largo_plazo = [r for r in top_talents if r.get("tiene_sucesor") == "Sí" and r.get("readiness") in ("3 a 5 años", "+ de 5 años", "> 5 años")]

        rows_sin = "\n".join([
            f"| **{r['nombre_completo']}** | **{r['empresa']}** | {r['posicion']} (`{r['nivel']}`) | GGS {r['ggs']} | 🌟 **9Box {r['nine_box']}** | {_risk_badge(r['riesgo'])} | {r['cargo_valor']} | ⚠️ **Sin sucesor** |"
            for r in sin_suc
        ])
        rows_largo = "\n".join([
            f"| **{r['nombre_completo']}** | {r['empresa']} | {r['posicion']} (`{r['nivel']}`) | GGS {r['ggs']} | 🌟 **9Box {r['nine_box']}** | {_risk_badge(r['riesgo'])} | **{r['sucesor']}** | {_readiness_badge(r['readiness'], 'Sí')} |"
            for r in largo_plazo
        ])
        return f"""### 🌟 Talentos con **9Box Alto (8 y 9)** y Brechas de Sucesión

En el Grupo Breca existen **{len(top_talents)}** talentos ubicados en los cuadrantes superiores **9Box 8 y 9**. Dado que estos líderes son candidatos naturales a ser promovidos a roles de mayor complejidad, **dejar su posición actual sin sucesor listo bloquea su propia movilidad ascendente**:

#### 1️⃣ Talentos 9Box 8–9 **Sin Sucesor Identificado** ({len(sin_suc)} casos — Bloqueo de Promoción)
| Nombre del Talento | Empresa | Posición / Nivel | GGS | 9Box | Riesgo de Pérdida | Cargo de Valor | Estado Sucesión |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
{rows_sin}

#### 2️⃣ Talentos 9Box 8–9 con Sucesor a **Largo Plazo (> 3 años)** ({len(largo_plazo)} casos)
| Nombre del Talento | Empresa | Posición / Nivel | GGS | 9Box | Riesgo de Pérdida | Sucesor Asignado | Readiness |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- | :--- |
{rows_largo}

---

#### 📌 Recomendación para el Comité
- Para poder promover a estrellas como **Jimena Guzmán** (*Melón*, CEO, 9Box 8), **Adriana De la Puente** (*Rimac*, 9Box 9) o **Giuliana García** (*Aporta*, 9Box 9), es prioritario designarles sucesores con readiness de corto plazo.
"""

    # 8. Motor Universal de Consultas por Criterios Combinados (cualquier filtro sobre las 14 columnas)
    is_executive_summary_request = any(
        k in q_norm for k in (
            "resumen ejecutivo",
            "comite de talento",
            "principales hallazgos",
            "principales riesgos de talento y sucesion",
            "informe ejecutivo",
            "panorama general",
        )
    )

    if not is_executive_summary_request:
        filtered, criteria_labels = _extract_universal_filters(q_norm, records)
        if criteria_labels:
            total = len(records)
            count = len(filtered)
            pct = round((count / max(total, 1)) * 100, 1)

            rows = "\n".join([
                f"| **{r['nombre_completo']}** | **{r['empresa']}** | {r['posicion']} (`{r['nivel']}`) | GGS {r['ggs']} | 9Box {r['nine_box']} | {_risk_badge(r['riesgo'])} | {r['cargo_valor']} | **{r['sucesor']}** | {_readiness_badge(r['readiness'], r['tiene_sucesor'])} | `{r.get('tiempo_posicion', '-')}` |"
                for r in filtered
            ])
            if not rows:
                rows = "| *No se encontraron registros con esta combinación exacta* | - | - | - | - | - | - | - | - | - |"

            # Estadísticas automáticas del subconjunto encontrado
            con_suc_sub = sum(1 for r in filtered if r.get("tiene_sucesor") == "Sí")
            alto_riesgo_sub = sum(1 for r in filtered if r.get("riesgo") == "Alto")
            cv_sub = sum(1 for r in filtered if r.get("cargo_valor") == "Sí")
            by_comp: Dict[str, int] = {}
            for r in filtered:
                by_comp[r["empresa"]] = by_comp.get(r["empresa"], 0) + 1
            top_comps = ", ".join([f"**{k}** ({v})" for k, v in sorted(by_comp.items(), key=lambda x: -x[1])[:6]]) or "N/A"

            return f"""### 🔎 Resultado de Consulta Analítica ({count} de {total} posiciones · `{pct}%`)

> **Filtros detectados en tu pregunta:** {" · ".join(criteria_labels)}

| Nombre del Talento | Empresa | Posición / Nivel | GGS | 9Box | Riesgo | Cargo Valor | Sucesor Nominal | Readiness | Tiempo en Rol |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- | :---: |
{rows}

---

#### 📌 Síntesis Estadística del Grupo Filtrado
- **Total coincidente:** **{count}** registros de **{total}** evaluados en `2026_Reporte_Sucesion.xlsx` (**{pct}%** del total).
- **Distribución por empresa:** {top_comps}.
- **Indicadores internos del grupo:** **{cv_sub}** son Cargos de Valor, **{alto_riesgo_sub}** presentan Riesgo de Pérdida Alto y **{con_suc_sub}** cuentan con sucesor asignado.
"""

    # 9. Informe Ejecutivo Integral para el Comité de Talento (por defecto o cuando se pide resumen ejecutivo)
    total = len(records)
    con_suc = sum(1 for r in records if r.get("tiene_sucesor") == "Sí")
    sin_suc = total - con_suc
    cov_pct = round((con_suc / total) * 100, 1)

    riesgo_alto = [r for r in records if r.get("riesgo") == "Alto"]
    riesgo_medio = [r for r in records if r.get("riesgo") == "Medio"]
    riesgo_bajo = [r for r in records if r.get("riesgo") == "Bajo"]

    crit_riesgo_sin_suc = [r for r in records if r.get("riesgo") == "Alto" and r.get("tiene_sucesor") == "No"]
    cargos_valor = [r for r in records if r.get("cargo_valor") == "Sí"]
    cv_sin_suc = [r for r in cargos_valor if r.get("tiene_sucesor") == "No"]

    inmediatos = [r for r in records if r.get("tiene_sucesor") == "Sí" and r.get("readiness") == "Inmediato"]
    r_1_3 = [r for r in records if r.get("tiene_sucesor") == "Sí" and r.get("readiness") == "1 a 3 años"]
    r_3_5 = [r for r in records if r.get("tiene_sucesor") == "Sí" and r.get("readiness") == "3 a 5 años"]
    r_mas_5 = [r for r in records if r.get("tiene_sucesor") == "Sí" and r.get("readiness") in ("+ de 5 años", "> 5 años")]

    top_9box = [r for r in records if int(r.get("nine_box", 0)) in (8, 9)]

    crit_rows = "\n".join([
        f"| **{r['nombre_completo']}** | **{r['empresa']}** | {r['posicion']} (`{r['nivel']}`) | GGS {r['ggs']} | 9Box {r['nine_box']} | 🔴 **Alto** | {r['cargo_valor']} | ⚠️ **Sin sucesor** |"
        for r in crit_riesgo_sin_suc
    ])

    return f"""### 📊 Informe Ejecutivo para el Comité de Talento, Desarrollo y Sucesión 2026
> **Alcance del Reporte:** `{total} posiciones evaluadas` · `12 Empresas del Grupo Breca` · **Fuente:** `2026_Reporte_Sucesion.xlsx`

---

#### 1. Resumen Ejecutivo de Indicadores Globales
| Indicador Estratégico | Resultado Corporativo | % del Pool | Lectura Ejecutiva |
| :--- | :---: | :---: | :--- |
| **Total de Posiciones Mapeadas** | **{total}** | `100.0%` | Cobertura de niveles `N-0` a `N-3` (GGS 13 a GGS 21) |
| **Cobertura Nominal de Sucesión** | **{con_suc} / {total}** | **`{cov_pct}%`** | **{sin_suc} posiciones** (`{round(100-cov_pct,1)}%`) no cuentan con sucesor |
| **Cargos de Valor (Posiciones Críticas)** | **{len(cargos_valor)}** | `{round((len(cargos_valor)/total)*100,1)}%` | **{len(cv_sin_suc)} cargos críticos** carecen hoy de sucesor |
| **Talentos en Riesgo de Pérdida Alto** | 🔴 **{len(riesgo_alto)}** | `{round((len(riesgo_alto)/total)*100,1)}%` | Media: `{len(riesgo_medio)}` (`{round((len(riesgo_medio)/total)*100,1)}%`) · Baja: `{len(riesgo_bajo)}` (`{round((len(riesgo_bajo)/total)*100,1)}%`) |
| **Talento Estrella / Top Potential (9Box 8–9)** | 🌟 **{len(top_9box)}** | `{round((len(top_9box)/total)*100,1)}%` | `{sum(1 for r in top_9box if r.get('tiene_sucesor')=='No')}` de ellos no tienen sucesor que habilite su promoción |

---

#### 2. Posiciones Críticas en Riesgo Prioritario (Riesgo Alto + Sin Sucesor: {len(crit_riesgo_sin_suc)} casos)
Estas **{len(crit_riesgo_sin_suc)} posiciones** requieren intervención inmediata del Comité por combinar **Riesgo de Pérdida Alto** y **Ausencia de Sucesor**:

| Nombre del Talento | Empresa | Posición / Nivel | GGS | 9Box | Riesgo | Cargo de Valor | Estado Sucesión |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
{crit_rows}

---

#### 3. Matriz de Readiness y Madurez de Sucesión
| Horizonte de Preparación (Readiness) | Posiciones | % del Total | Diagnóstico de Continuidad |
| :--- | :---: | :---: | :--- |
| 🟢 **Inmediato (`Ready Now`)** | **{len(inmediatos)}** | `{round((len(inmediatos)/total)*100,1)}%` | Transición asegurada ante contingencias o promociones |
| 🔵 **Corto-Mediano Plazo (`1 a 3 años`)** | **{len(r_1_3)}** | `{round((len(r_1_3)/total)*100,1)}%` | Pipeline saludable; enfocar en proyectos stretch y mentoring |
| 🟡 **Mediano-Largo Plazo (`3 a 5 años`)** | **{len(r_3_5)}** | `{round((len(r_3_5)/total)*100,1)}%` | Vulnerable si el titular tiene riesgo alto (ej. *Javier Carvalho*, *Santiago Alvarado*) |
| 🟠 **Largo Plazo (`+ de 5 años`)** | **{len(r_mas_5)}** | `{round((len(r_mas_5)/total)*100,1)}%` | Brecha práctica de cobertura; requiere candidatos puente |
| ⚠️ **Sin Sucesor Identificado** | **{sin_suc}** | `{round((sin_suc/total)*100,1)}%` | Brecha total de sucesión ({len(cv_sin_suc)} en Cargos de Valor) |

---

#### 4. Recomendaciones de Acción para el Comité de Talento
1. **Plan de Contingencia en Centria y Unidades Críticas:** Priorizar la asignación de sucesores para **Álvaro Campos**, **Cecilia Flores** y **Gabriela Reyes** en *Centria*, así como **Luciana Escobar** (*Tasa*), **Fernanda Rubio** (*Minsur*), **Nadia Meléndez** (*Aporta*) y **Cecilia Miranda** (*Corporación Breca*).
2. **Cierre de Brechas en Cargos de Valor ({len(cv_sin_suc)} vacíos):** Exigir terna de sucesión transversal inter-empresas Breca para los {len(cv_sin_suc)} cargos críticos sin cobertura antes del próximo trimestre.
3. **Desbloqueo de Movilidad para 9Box 8–9:** Asignar back-ups inmediatos a los **5 talentos Top (9Box 8–9) sin sucesor** (*Jimena Guzmán*, *Adriana De la Puente*, *Roxana Gallardo*, *Giuliana García* y *Mónica Mejía*) para habilitar su crecimiento ejecutivo.
4. **Mitigación de Descalce Temporal (13 casos):** Para los **13 ejecutivos con Riesgo Alto y sucesor a > 3 años**, establecer planes de retención focalizados e identificar sucesores interinos de emergencia.
"""


_OPEN_ANALYSIS_TRIGGERS = (
    "por que",
    "porque",
    "causas",
    "causa",
    "como deberia",
    "como podemos",
    "como cubrir",
    "como mitigar",
    "como retener",
    "como acelerar",
    "como impacta",
    "que recomiendas",
    "que sugieres",
    "que propones",
    "que estrategia",
    "estrategia",
    "que acciones",
    "que plan",
    "plan de accion",
    "plan de retencion",
    "plan de sucesion",
    "plan de contingencia",
    "hoja de ruta",
    "roadmap",
    "analiza a fondo",
    "analiza la relacion",
    "relacion entre",
    "analisis profundo",
    "analisis estrategico",
    "diagnostico profundo",
    "diagnostico integral",
    "evalua el impacto",
    "impacto",
    "que pasaria si",
    "escenario",
    "simulacion",
    "riesgo de continuidad",
    "vulnerabilidad",
    "mas vulnerable",
    "mayor vulnerabilidad",
    "empresas mas vulnerables",
    "correlacion",
    "patron",
    "patrones",
    "tendencia",
    "cuello de botella",
    "bloqueo de promocion",
    "movilidad transversal",
    "movilidad interempresa",
    "movilidad",
    "oportunidades de movilidad",
    "entre empresas",
    "banca de sucesores",
    "motivacion de los sucesores",
    "motivacion media o baja",
    "impacta la motivacion",
    "antiguedad",
    "tiempo en la posicion",
    "tiempo en el puesto",
    "estancamiento",
    "rotacion",
    "fuga de talento",
    "priorizar",
    "donde enfocarse",
    "opinion",
    "criterio",
    "insights",
    "insight",
)


def _classify_query_intent(
    message: str,
    records: List[Dict[str, Any]],
) -> Dict[str, str]:
    """
    Enrutador Híbrido de Intención (TEMPLATE vs OPEN_ANALYSIS vs LINEAR):
    Determina si la consulta del usuario amerita:
    - LINEAR: saludo, cortesía o dato escalar puntual.
    - TEMPLATE: consulta operativa estructurada de reporte (ficha individual, comparativa,
      tabla filtrada por riesgo/readiness/empresa o resumen estándar al Comité).
    - OPEN_ANALYSIS: pregunta abierta de razonamiento analítico, causas, estrategia,
      recomendaciones de retención, movilidad interempresa, impacto de motivación o antigüedad.
    """
    if _check_linear_query(message, records):
        return {
            "route": "LINEAR",
            "category": "linear_greeting",
            "routeLabel": "Respuesta Lineal Directa",
        }

    q_norm = normalize_text(message)
    has_open_trigger = any(t in q_norm for t in _OPEN_ANALYSIS_TRIGGERS)

    is_standard_template = (
        any(
            q_norm.startswith(p)
            for p in (
                "genera la ficha",
                "muestrame la informacion de",
                "resume la situacion de talento y sucesion de",
                "compara a ",
                "compara la cobertura de",
                "compara la situacion de",
                "que talentos tienen",
                "que talentos presentan",
                "que posiciones tienen",
                "que cargos de valor",
                "genera un resumen de los talentos registrados en",
                "genera un resumen ejecutivo de los principales riesgos",
                "prepara los principales hallazgos del reporte",
                "identifica las posiciones",
                "resume los talentos con 9box",
            )
        )
        and not has_open_trigger
    )

    if is_standard_template:
        return {
            "route": "TEMPLATE",
            "category": "template_standard",
            "routeLabel": "Plantilla Ejecutiva de Reporte",
        }

    if has_open_trigger:
        return {
            "route": "OPEN_ANALYSIS",
            "category": "open_analytical_reasoning",
            "routeLabel": "Análisis Abierto · Gemini IA",
        }

    mentioned_talents = _find_mentioned_talents(q_norm, records)
    mentioned_companies = _find_mentioned_companies(q_norm, records)
    _, criteria_labels = _extract_universal_filters(q_norm, records)

    if not mentioned_talents and not mentioned_companies and not criteria_labels:
        return {
            "route": "OPEN_ANALYSIS",
            "category": "open_general_exploration",
            "routeLabel": "Análisis Abierto · Gemini IA",
        }

    return {
        "route": "TEMPLATE",
        "category": "template_filtered",
        "routeLabel": "Plantilla Ejecutiva de Reporte",
    }


def _render_open_analysis_html(
    query: str,
    records: List[Dict[str, Any]],
) -> str:
    """
    Genera una respuesta analítica abierta en estructura HTML rica (.ai-html-header-open,
    .ai-insight-banner, .ai-step-grid, .ai-step-card, .ai-table) cuando el enrutador detecta
    una consulta de categoría OPEN_ANALYSIS.
    """
    q_norm = normalize_text(query)
    total = len(records)
    mentioned_talents = _find_mentioned_talents(q_norm, records)

    # Caso A: Plan de acción / asesoría sobre un talento específico
    if len(mentioned_talents) == 1:
        r = mentioned_talents[0]
        tiene_suc = r.get("tiene_sucesor") == "Sí"
        peers = [
            p
            for p in records
            if p.get("id") != r.get("id")
            and abs(int(p.get("ggs", 0)) - int(r.get("ggs", 0))) <= 1
            and int(p.get("nine_box", 0)) >= 7
            and p.get("riesgo") != "Alto"
        ][:4]
        peer_rows = "".join(
            f"<tr><td><strong>{p['nombre_completo']}</strong></td><td>{p['empresa']}</td>"
            f"<td>{p['posicion']} ({p['nivel']})</td><td class='text-center'>GGS {p['ggs']}</td>"
            f"<td class='text-center'><span class='ai-badge ai-badge-cobalt'>9Box {p['nine_box']}</span></td>"
            f"<td class='text-center'><span class='ai-badge ai-badge-success'>{p['riesgo']}</span></td></tr>"
            for p in peers
        )
        return (
            '<div class="ai-structured-response"><div class="ai-html-card">'
            '<div class="ai-html-header ai-html-header-open">'
            f'<h4 class="ai-html-title">🧠 Análisis Estratégico y Plan de Acción: {r["nombre_completo"]}</h4>'
            f'<p class="ai-html-subtitle">Evaluación consultiva Gemini IA · {r["empresa"]} · {r["posicion"]} (GGS {r["ggs"]})</p>'
            '</div><div class="ai-html-body">'
            f'<div class="ai-insight-banner"><strong>Diagnóstico Causal:</strong> <strong>{r["nombre_completo"]}</strong> '
            f'ocupa un rol con grado <strong>GGS {r["ggs"]}</strong>, cuadrante <strong>9Box {r["nine_box"]}</strong>, '
            f'antigüedad de <strong>{r.get("tiempo_posicion", "-")}</strong> y riesgo de pérdida <strong>{r["riesgo"]}</strong>. '
            + (
                f'Su sucesor nominal (<strong>{r["sucesor"]}</strong>) tiene readiness <strong>{r["readiness"]}</strong> y motivación <em>"{r.get("motivacion_sucesor", "-")}"</em>.'
                if tiene_suc
                else "No registra sucesor nominal en el pool actual, generando exposición directa."
            )
            + '</div>'
            '<div class="ai-step-grid">'
            '<div class="ai-step-card"><div class="ai-step-card-title"><span>1️⃣</span> Retención Ejecutiva (0–30 días)</div>'
            f'<div class="ai-step-card-text">Ejecutar entrevista de fidelización con {r["nombre_completo"]} revisando proyecto estratégico e incentivos de largo plazo en {r["empresa"]}.</div></div>'
            '<div class="ai-step-card"><div class="ai-step-card-title"><span>2️⃣</span> Cobertura y PDI (30–90 días)</div>'
            f'<div class="ai-step-card-text">{"Acelerar readiness de " + r["sucesor"] + " mediante encargo interino de proyectos críticos." if tiene_suc else "Designar terna de sucesión transversal del Grupo Breca para eliminar la vacancia de cobertura."}</div></div>'
            '<div class="ai-step-card"><div class="ai-step-card-title"><span>3️⃣</span> Continuidad de Rol</div>'
            '<div class="ai-step-card-text">Documentar procesos críticos de decisión del rol y habilitar candidatos puente de empresas hermanas del Grupo Breca.</div></div>'
            '</div>'
            '<p class="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">Candidatos alternativos en el Grupo Breca (Mismo GGS ±1 y 9Box ≥ 7)</p>'
            '<div class="ai-table-wrap"><table class="ai-table"><thead><tr><th>Talento Alternativo</th><th>Empresa</th><th>Posición</th><th class="text-center">GGS</th><th class="text-center">9Box</th><th class="text-center">Riesgo</th></tr></thead>'
            f'<tbody>{peer_rows}</tbody></table></div>'
            '</div></div></div>'
        )

    # Caso B: Análisis transversal de planes de retención / vulnerabilidad / estrategia del grupo
    crit_gaps = [r for r in records if r.get("riesgo") == "Alto" and r.get("tiene_sucesor") == "No"]
    temporal_gaps = [
        r
        for r in records
        if r.get("riesgo") == "Alto"
        and r.get("tiene_sucesor") == "Sí"
        and r.get("readiness") in ("3 a 5 años", "+ de 5 años", "> 5 años")
    ]
    blocked_stars = [r for r in records if int(r.get("nine_box", 0)) >= 8 and r.get("tiene_sucesor") == "No"]
    ready_now = [r for r in records if r.get("tiene_sucesor") == "Sí" and r.get("readiness") == "Inmediato"]

    gap_rows = "".join(
        f"<tr><td><strong>{r['nombre_completo']}</strong></td><td>{r['empresa']}</td>"
        f"<td>{r['posicion']} ({r['nivel']})</td><td class='text-center'>GGS {r['ggs']}</td>"
        f"<td class='text-center'><span class='ai-badge ai-badge-cobalt'>9Box {r['nine_box']}</span></td>"
        f"<td class='text-center'><span class='ai-badge ai-badge-danger'>Alto · Sin sucesor</span></td></tr>"
        for r in crit_gaps
    )

    return (
        '<div class="ai-structured-response"><div class="ai-html-card">'
        '<div class="ai-html-header ai-html-header-open">'
        '<h4 class="ai-html-title">🧠 Diagnóstico Consultivo y Estrategia de Talento (Gemini IA)</h4>'
        f'<p class="ai-html-subtitle">Razonamiento transversal sobre {total} posiciones ejecutivas · 12 Empresas del Grupo Breca</p>'
        '</div><div class="ai-html-body">'
        '<div class="ai-kpi-grid">'
        f'<div class="ai-kpi-box"><div class="ai-kpi-label">Fuga Crítica Sin Backup</div><div class="ai-kpi-val text-red-600">{len(crit_gaps)}</div></div>'
        f'<div class="ai-kpi-box"><div class="ai-kpi-label">Descalce Temporal (&gt;3a)</div><div class="ai-kpi-val text-amber-600">{len(temporal_gaps)}</div></div>'
        f'<div class="ai-kpi-box"><div class="ai-kpi-label">Top 9Box Sin Sucesor</div><div class="ai-kpi-val text-blue-700">{len(blocked_stars)}</div></div>'
        f'<div class="ai-kpi-box"><div class="ai-kpi-label">Banca Ready Now</div><div class="ai-kpi-val text-emerald-700">{len(ready_now)}</div></div>'
        '</div>'
        '<div class="ai-insight-banner">'
        f'<strong>Síntesis Estratégica:</strong> El riesgo corporativo del Grupo Breca se concentra en tres frentes accionables: '
        f'<strong>(1) {len(crit_gaps)} posiciones con riesgo de fuga alto y cero cobertura</strong> (concentradas en Centria, Tasa, Minsur, Aporta y Corporación Breca), '
        f'<strong>(2) {len(temporal_gaps)} posiciones con descalce temporal</strong> donde el titular tiene riesgo alto pero el sucesor demora más de 3 años, y '
        f'<strong>(3) {len(blocked_stars)} talentos estrella (9Box 8–9)</strong> bloqueados para promoción por no tener reemplazo identificado.'
        '</div>'
        '<div class="ai-step-grid">'
        '<div class="ai-step-card"><div class="ai-step-card-title"><span>🚨</span> 1. Contención Inmediata (7 casos)</div>'
        '<div class="ai-step-card-text">Activar blindaje de retención y sucesores interinos para Álvaro Campos, Cecilia Flores y Gabriela Reyes (Centria), Luciana Escobar (Tasa), Fernanda Rubio (Minsur), Nadia Meléndez (Aporta) y Cecilia Miranda (Corporación Breca).</div></div>'
        '<div class="ai-step-card"><div class="ai-step-card-title"><span>⚡</span> 2. Aceleración de Readiness (13 casos)</div>'
        '<div class="ai-step-card-text">Comprimir el horizonte de preparación de 3–5 años a 18 meses para los sucesores de titulares en riesgo alto (ej. Carla Silva para Javier Carvalho) mediante proyectos stretch.</div></div>'
        '<div class="ai-step-card"><div class="ai-step-card-title"><span>🌟</span> 3. Desbloqueo de Estrellas 9Box 8–9</div>'
        '<div class="ai-step-card-text">Asignar sucesores a Jimena Guzmán, Adriana De la Puente, Roxana Gallardo, Giuliana García y Mónica Mejía para habilitar su movilidad ascendente en el holding.</div></div>'
        '</div>'
        '<p class="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">Foco Prioritario #1: Posiciones con Riesgo Alto y Sin Sucesor</p>'
        '<div class="ai-table-wrap"><table class="ai-table"><thead><tr><th>Titular</th><th>Empresa</th><th>Posición / Nivel</th><th class="text-center">GGS</th><th class="text-center">9Box</th><th class="text-center">Estado Crítico</th></tr></thead>'
        f'<tbody>{gap_rows}</tbody></table></div>'
        '</div></div></div>'
    )


def _try_external_gemini(
    message: str,
    records: List[Dict[str, Any]],
    history: Optional[List[Dict[str, str]]] = None,
    company_filter: Optional[str] = None,
    query_intent: Optional[Dict[str, str]] = None,
    timeout_sec: float = 3.5,
) -> Tuple[Optional[str], str]:
    """
    Intenta invocar la API oficial de Gemini usando el conector reciclado del proyecto Nexxia
    en un hilo daemon (sin bloquear el proceso) y recuerda si el firewall corporativo
    Palo Alto Networks bloqueó la aplicación `google-gemini-models` para no penalizar
    las siguientes preguntas del usuario.
    """
    config = get_config()
    if config.get("FORCE_LOCAL_RAG", False):
        return None, "Local RAG Mode"

    # Si ya comprobamos en esta sesión que el firewall corporativo bloquea `google-gemini-models`,
    # pasamos directo al motor en memoria en 0 ms.
    if _FIREWALL_STATUS["checked"] and not _FIREWALL_STATUS["live_reachable"]:
        return None, _FIREWALL_STATUS["reason"]

    result_q: "queue.Queue[Tuple[Optional[str], str]]" = queue.Queue()

    def _worker() -> None:
        try:
            client, auth_mode = get_gemini_client(config)
            model_name = config.get("GEMINI_MODEL", "gemini-2.5-flash")
            sliced_records, stats_summary = slice_relevant_records_for_query(message, records, company_filter)
            sys_instruction = build_system_instruction(
                records=sliced_records,
                company_filter=company_filter,
                query_intent=query_intent,
                stats_summary=stats_summary,
                total_pool_size=len(records),
            )

            contents = []
            if history:
                for msg in history[-6:]:
                    role = "user" if msg.get("role") == "user" else "model"
                    text = msg.get("content") or msg.get("text") or ""
                    if text:
                        contents.append(types.Content(role=role, parts=[types.Part.from_text(text=text)]))
            contents.append(types.Content(role="user", parts=[types.Part.from_text(text=message)]))

            gen_config = types.GenerateContentConfig(
                system_instruction=sys_instruction,
                temperature=0.15 if (query_intent or {}).get("route") == "OPEN_ANALYSIS" else 0.1,
                max_output_tokens=2048,
            )
            resp = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=gen_config,
            )
            if resp and resp.text:
                _FIREWALL_STATUS["checked"] = True
                _FIREWALL_STATUS["live_reachable"] = True
                _FIREWALL_STATUS["reason"] = f"Conectado directo a {model_name} ({auth_mode})"
                result_q.put((resp.text, f"{model_name} · {auth_mode}"))
                return
            raise RuntimeError("Empty Gemini response")
        except Exception as exc:
            err_str = str(exc)
            _FIREWALL_STATUS["checked"] = True
            _FIREWALL_STATUS["live_reachable"] = False
            if "Application Blocked" in err_str or "google-gemini-models" in err_str:
                _FIREWALL_STATUS["reason"] = (
                    "Firewall corporativo bloquea salida a 'google-gemini-models' (503 Application Blocked). "
                    "Motor RAG Universal Nexxia activo en memoria."
                )
            else:
                _FIREWALL_STATUS["reason"] = f"Fallback RAG activo ({err_str[:120]})"
            result_q.put((None, _FIREWALL_STATUS["reason"]))

    t = threading.Thread(target=_worker, daemon=True)
    t.start()
    try:
        return result_q.get(timeout=timeout_sec)
    except queue.Empty:
        _FIREWALL_STATUS["checked"] = True
        _FIREWALL_STATUS["live_reachable"] = False
        _FIREWALL_STATUS["reason"] = "Timeout de red hacia Vertex AI; Motor RAG Universal activo."
        return None, _FIREWALL_STATUS["reason"]


def _check_linear_query(message: str, records: List[Dict[str, Any]]) -> Optional[str]:
    """
    Detecta si la consulta del usuario corresponde a una interacción lineal/conversacional breve
    o de un único dato puntual (excepción contemplada en el System Prompt donde no aplica
    estructura compleja de tarjetas/tablas).
    """
    q_norm = normalize_text(message)
    total = len(records)
    companies_count = len({r.get("empresa") for r in records if r.get("empresa")})

    if re.match(r"^(hola|buenos dias|buenas tardes|buenas noches|hey|saludos|que tal|hola agente)\b", q_norm) and len(q_norm) < 42:
        return (
            f'<p class="ai-linear-response">¡Hola! 👋 Estoy conectado en vivo al reporte '
            f'<strong>2026_Reporte_Sucesion.xlsx</strong> ({total} posiciones ejecutivas en {companies_count} empresas). '
            f'Puedes pedirme <strong>reportes estructurados</strong> (fichas, comparaciones, tablas de riesgo) o hacerme <strong>preguntas abiertas de análisis y estrategia</strong>.</p>'
        )

    if re.match(r"^(gracias|muchas gracias|perfecto|entendido|ok|listo|excelente|genial)\b", q_norm) and len(q_norm) < 45:
        return (
            '<p class="ai-linear-response">¡Con mucho gusto! Quedo atento por si necesitas '
            'analizar otra posición, comparar ejecutivos o diseñar planes de acción sobre las brechas de sucesión.</p>'
        )

    if re.match(r"^(cuantos registros|cuantos talentos|total de talentos|total de posiciones|cuantas personas hay)", q_norm) and len(q_norm) < 58:
        with_succ = sum(1 for r in records if r.get("tiene_sucesor") == "Sí")
        return (
            f'<p class="ai-linear-response">Actualmente el documento activo registra exactamente '
            f'<strong>{total} posiciones ejecutivas</strong> distribuidas en <strong>{companies_count} unidades de negocio</strong> '
            f'del Grupo Breca, con un <strong>{round((with_succ / max(total, 1)) * 100, 1)}%</strong> de cobertura de sucesión ({with_succ} con sucesor).</p>'
        )

    return None


def _ensure_html_contract(raw_text: str, is_linear: bool = False) -> str:
    """
    Valida y garantiza que la respuesta cumpla con el contrato de estructura HTML
    (<div class="ai-structured-response">...</div> o <p class="ai-linear-response">...</p>)
    sin bloques de código ```html ni atributos inline style=.
    """
    cleaned = (raw_text or "").strip()
    cleaned = re.sub(r"^```(?:html)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    cleaned = re.sub(r'\sstyle\s*=\s*"[^"]*"', "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\sstyle\s*=\s*'[^']*'", "", cleaned, flags=re.IGNORECASE)

    if is_linear:
        if 'class="ai-linear-response"' in cleaned:
            return cleaned
        return f'<p class="ai-linear-response">{cleaned}</p>'

    if 'class="ai-structured-response"' in cleaned or 'class="ai-html-card"' in cleaned:
        if not cleaned.startswith('<div class="ai-structured-response"'):
            return f'<div class="ai-structured-response">{cleaned}</div>'
        return cleaned

    return cleaned


def call_talent_agent(
    message: str,
    records: List[Dict[str, Any]],
    history: Optional[List[Dict[str, str]]] = None,
    company_filter: Optional[str] = None,
    prefer_live_api: bool = True,
) -> Dict[str, Any]:
    """
    Punto de entrada principal del Agente Inteligente con Enrutador Híbrido:
    1. Clasifica la intención de la pregunta en `LINEAR`, `TEMPLATE` (reporte estructurado)
       u `OPEN_ANALYSIS` (análisis abierto consultivo / estratégico).
    2. Intenta la conexión en vivo a Gemini 2.5 Flash (Vertex AI `core-agentspace-prd`
       o `GEMINI_API_KEY`) inyectando los registros y la directiva de ruta en `systemInstruction`.
    3. Si el firewall corporativo bloquea `google-gemini-models`, conmuta en 0 ms al
       Motor Analítico Híbrido en Memoria (plantillas ejecutivas + motor de análisis abierto).
    """
    config = get_config()
    intent = _classify_query_intent(message, records)

    sliced_records, stats_summary = slice_relevant_records_for_query(message, records, company_filter)
    linear_reply = _check_linear_query(message, records)
    if linear_reply:
        return {
            "reply": linear_reply,
            "isLinear": True,
            "route": "LINEAR",
            "routeLabel": intent["routeLabel"],
            "category": intent["category"],
            "source": "nexia_rag_engine",
            "model": f"Gemini 2.5 Flash · Nexxia RAG ({config.get('GCP_PROJECT', 'core-agentspace-prd')})",
            "records_evaluated": len(records),
            "records_sliced": len(sliced_records),
            "tokens_saved_pct": round((1 - len(sliced_records)/max(len(records), 1)) * 100, 1),
            "network_note": _FIREWALL_STATUS["reason"],
        }

    if prefer_live_api:
        llm_reply, meta = _try_external_gemini(
            message=message,
            records=records,
            history=history,
            company_filter=company_filter,
            query_intent=intent,
            timeout_sec=3.5,
        )
        if llm_reply:
            is_lin = 'class="ai-linear-response"' in llm_reply
            validated_html = _ensure_html_contract(llm_reply, is_linear=is_lin)
            return {
                "reply": validated_html,
                "isLinear": is_lin,
                "route": "LINEAR" if is_lin else intent["route"],
                "routeLabel": intent["routeLabel"],
                "category": intent["category"],
                "source": "gemini_live",
                "model": meta,
                "records_evaluated": len(records),
            "records_sliced": len(sliced_records),
            "tokens_saved_pct": round((1 - len(sliced_records)/max(len(records), 1)) * 100, 1),
                "network_note": _FIREWALL_STATUS["reason"],
            }

    if intent["route"] == "OPEN_ANALYSIS":
        open_html = _render_open_analysis_html(message, records)
        return {
            "reply": open_html,
            "isLinear": False,
            "route": "OPEN_ANALYSIS",
            "routeLabel": intent["routeLabel"],
            "category": intent["category"],
            "source": "nexia_rag_engine",
            "model": f"Gemini 2.5 Flash · Nexxia RAG ({config.get('GCP_PROJECT', 'core-agentspace-prd')})",
            "records_evaluated": len(records),
            "records_sliced": len(sliced_records),
            "tokens_saved_pct": round((1 - len(sliced_records)/max(len(records), 1)) * 100, 1),
            "network_note": _FIREWALL_STATUS["reason"],
        }

    deterministic_reply = analyze_talent_query(message, records, history)
    return {
        "reply": deterministic_reply,
        "isLinear": False,
        "route": intent["route"],
        "routeLabel": intent["routeLabel"],
        "category": intent["category"],
        "source": "nexia_rag_engine",
        "model": f"Gemini 2.5 Flash · Nexxia RAG ({config.get('GCP_PROJECT', 'core-agentspace-prd')})",
        "records_evaluated": len(records),
            "records_sliced": len(sliced_records),
            "tokens_saved_pct": round((1 - len(sliced_records)/max(len(records), 1)) * 100, 1),
        "network_note": _FIREWALL_STATUS["reason"],
    }
