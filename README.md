# Centria | Talent & Succession Intelligence (Demo 2026)

Plataforma ejecutiva interactiva para la visualización, analítica y consulta asistida por Inteligencia Artificial del reporte corporativo de talento y sucesión (`2026_Reporte_Sucesion.xlsx` — **101 posiciones clave y 14 dimensiones de datos** en 12 unidades de negocio del Grupo Breca).

---

## 🏛️ Arquitectura 100% Estática y Autónoma

La aplicación está diseñada bajo una arquitectura web estática moderna y liviana, sin dependencias de servidores backend para su ejecución:

- **Frontend Reactivo Nativo**: HTML5 semántico, Tailwind CSS y CSS Custom Properties alineados al Sistema de Diseño Centria / Breca.
- **Visualización de Datos**: Chart.js para dashboards y distribución 9-Box en vivo.
- **Motor de Datos In-Memory**: Carga instantánea de los 101 registros oficiales (`initial-data.js`) con soporte de importación y exportación de archivos `.xlsx` en el navegador vía SheetJS.
- **Inteligencia de Talento en 2 Vías**:
  1. **Plantillas Ejecutivas (`TEMPLATE`)**: Respuestas inmediatas a consultas frecuentes (fichas individuales, alertas de retención, comparativas 1 a 1, comités) con filtrado previo en memoria y cero consumo de tokens.
  2. **Análisis Abierto y Estratégico (`OPEN_ANALYSIS`)**: Consultas causales e hipotéticas evaluadas por **Google Gemini 2.5 Flash** (o por el motor RAG local avanzado) utilizando un **Digestor Inteligente de Datos** (`digestTalentDocumentForLLM`) que sintetiza las 14 columnas del reporte en métricas macro, riesgos ocultos y hojas de ruta.

---

## 📁 Estructura Limpia del Proyecto

```text
Talent-Succession-Intelligence/
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD automatizado para GitHub Pages
├── 2026_Reporte_Sucesion.xlsx      # Documento oficial corporativo (Talent Pool Grupo Breca)
├── index.html                      # Página principal única (Single Page Application)
├── style.css                       # Tokens de diseño, tipografía y componentes Centria
├── app.js                          # Lógica del cliente, dashboard, filtros y digestor LLM
├── client-agent.js                 # Motor analítico RAG, enrutador de intents y plantillas
├── initial-data.js                 # Datos embebidos del Excel para carga instantánea
├── .gitignore                      # Reglas de exclusión limpias
└── README.md                       # Documentación ejecutiva del proyecto
```

---

## 🚀 Despliegue en GitHub Pages

1. **Configurar en GitHub**:
   - Ingresa a tu repositorio en GitHub: **Settings → Pages**.
   - En **Build and deployment → Source**, selecciona **Deploy from a branch** (rama `main`, carpeta `/ (root)`), o bien selecciona **GitHub Actions** para utilizar el pipeline automatizado en `.github/workflows/deploy.yml`.
   - Guarda los cambios.

2. **Acceso a la Demo Web**:
   - URL oficial: **https://julio242023.github.io/Talent-Succession-Intelligence/**

3. **Uso de Google Gemini (Opcional y Silencioso)**:
   - Para conectar Gemini 2.5 Flash de forma transparente, basta con abrir la URL pasando tu clave:  
     `https://julio242023.github.io/Talent-Succession-Intelligence/?key=TU_GEMINI_API_KEY`  
     *(Se almacena silenciosamente en `localStorage` sin mostrar campos técnicos en la interfaz)*.
   - Si no se proporciona clave, el sistema responde con su motor analítico RAG local sin interrupciones.
