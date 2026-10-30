# BRECA | Talent & Succession Intelligence (Demo 2026)

Plataforma ejecutiva interactiva para la visualización, analítica y consulta asistida por Inteligencia Artificial del reporte corporativo de talento y sucesión (`2026_Reporte_Sucesion.xlsx` — **101 posiciones clave y 14 dimensiones de datos** en 12 unidades de negocio del Grupo Breca).

---

## 🎨 Sistema de Diseño Minimalista y Arquitectura 100% Modular

Toda la interfaz, los dashboards en vivo, las tablas generadas y las fichas ejecutivas operan bajo una **arquitectura modular centralizada** (cero atributos `style="..."` inline), gobernada desde `:root` en `style.css` y el objeto `BRECA_THEME` en `app.js`:

| Token Semántico | Color Hex | RGB | Uso Principal en la Plataforma |
| :--- | :--- | :--- | :--- |
| `--breca-gray` | `#B2B1B1` | `rgb(178, 177, 177)` | Bordes neutros, divisores suaves, estados base y fondos secundarios |
| `--breca-slate` | `#65676B` | `rgb(101, 103, 107)` | Texto secundario, subtítulos, metadatos y cabeceras de columnas 3 y 4 de la Ficha |
| `--breca-charcoal` | `#1D242C` | `rgb(29, 36, 44)` | Cabeceras principales, navegación activa, riesgo crítico y bloques 1 y 2 de la Ficha |
| `--breca-black` | `#000000` | `rgb(0, 0, 0)` | Títulos de alto contraste, valores KPI y marca tipográfica `BRECA` |
| `--breca-sage` | `#4D6F61` | `rgb(77, 111, 97)` | Sucesión cubierta, estado saludable (*Ready Now* / riesgo bajo) e indicadores positivos |
| `--breca-teal` | `#467080` | `rgb(70, 112, 128)` | Sucesión en corto/mediano plazo, estado intermedio y etiquetas analíticas |
| `--breca-petrol` | `#005E85` | `rgb(0, 94, 133)` | Acento corporativo principal, acciones primarias, marco **Strong Fit** y tablas de Readiness |
| `--breca-gold` | `#F2B705` | `rgb(242, 183, 5)` | Uso exclusivo para la píldora distintiva **Cargo de Valor** |

---

## 🗂️ Doble Modalidad de la "Valoración Ejecutiva Ecualizada" (Ficha Breca)

La **Ficha de Valoración Ejecutiva Ecualizada** reproduce fielmente la estructura corporativa de comité de talento en 4 bloques (*1. Trayectoria y Contexto*, *2. Fit con el Rol — Strong Fit*, *3. Readiness, Motivación y Sucesión*, *4. Decisión y Gestión*) y cuenta con dos modos de visualización adaptados al contexto de uso:

1. **Modo 1 — Ventana Flotante Independiente (4 Columnas en Fila)**:
   - Se activa al hacer clic en el botón **"Ver Ficha"** desde cualquier fila del Directorio de Talentos (fuera del Agente IA).
   - Despliega una ventana modal flotante (`#ficha-modal-overlay`) en formato lámina panorámica de 4 columnas lado a lado, e incluye acceso directo para abrir el análisis del ejecutivo en el Agente IA.
2. **Modo 2 — Vista Dividida en el Lienzo del Agente IA (2 Columnas Arriba + 2 Debajo)**:
   - Cuando la ficha se solicita o genera dentro del Agente IA (`#ai-canvas-body`), el diseño se divide automáticamente en una cuadrícula `2×2` (2 bloques superiores y 2 inferiores) con escala tipográfica y de componentes compacta para garantizar visibilidad total sin desbordes.

---

## 🤖 Workspace Ampliado del Agente IA (`98vw × 96vh`)

El espacio de trabajo del Agente IA se abre directamente en **modo ampliado** y divide la pantalla en una proporción ergonómica **64% Lienzo Visual / 36% Chat Conversacional** en escritorio:

- **Lienzo Izquierdo de Resultados (`#ai-canvas-panel` — 64%)**:
  - **Pestaña inicial `Resumen`**: Muestra los dos gráficos ejecutivos de *Cobertura y Riesgo* y *Pipeline de Sucesión y 9-Box* únicamente al iniciar o volver al resumen general, sin repetirlos en las subpestañas de resultados (`#1`, `#2`, etc.).
  - **Dimensionamiento Natural de Componentes**: Las tablas y tarjetas de métricas adoptan el ancho natural de su contenido (`width: fit-content` / `auto` con `max-width: 100%`) sin estirarse artificialmente, mientras que las fichas ejecutivas y grillas compuestas ocupan el 100% del lienzo.
  - **Escala Compacta Modular**: Tipografía, paddings y badges ligeramente más compactos para maximizar la densidad de información visible.
- **Panel Derecho de Chat Conversacional (`#ai-chat-panel` — 36%)**:
  - Contención estricta de caja (`min-width: 0`, `max-width: 100%`, `overflow-wrap: break-word`) para resúmenes ejecutivos, burbujas de diálogo, selector de plantillas (`Ver plantillas ▼`) y chips de seguimiento (`Continuar:`).
- **Inteligencia de Talento en 2 Vías**:
  1. **Plantillas Ejecutivas (`TEMPLATE`)**: Respuestas instantáneas a consultas frecuentes (fichas individuales, alertas de retención, comparativas 1 a 1, comités) con filtrado en memoria y cero consumo de tokens.
  2. **Análisis Abierto y Estratégico (`OPEN_ANALYSIS`)**: Consultas causales e hipotéticas evaluadas por **Google Gemini 2.5 Flash** (o por el motor RAG local avanzado) utilizando el **Digestor Inteligente de Datos** (`digestTalentDocumentForLLM`).

---

## 📁 Estructura del Proyecto

```text
Talent-Succession-Intelligence/
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD automatizado para GitHub Pages
├── 2026_Reporte_Sucesion.xlsx      # Documento oficial corporativo (Talent Pool Grupo Breca)
├── index.html                      # Aplicación Single Page (Dashboard, Modal de Ficha y Workspace IA)
├── style.css                       # Sistema de Diseño Modular Breca (:root, fichas 4-col/2x2, tablas y chat)
├── app.js                          # Estado global, gráficos Chart.js/SVG (BRECA_THEME), modal de ficha y split-view
├── client-agent.js                 # Motor analítico RAG, enrutador de intents y generador de Fichas y Reportes
├── initial-data.js                 # 101 registros oficiales embebidos para carga instantánea en memoria
├── .gitignore                      # Reglas de exclusión del repositorio
└── README.md                       # Documentación técnica y funcional del proyecto
```

---

## 🚀 Despliegue en GitHub Pages

1. **Configurar en GitHub**:
   - Ingresa al repositorio en GitHub: **Settings → Pages**.
   - En **Build and deployment → Source**, selecciona **Deploy from a branch** (rama `main`, carpeta `/ (root)`), o bien **GitHub Actions** usando `.github/workflows/deploy.yml`.
2. **Acceso a la Demo Web**:
   - URL oficial: **https://julio242023.github.io/Talent-Succession-Intelligence/**
3. **Conexión con Google Gemini (Opcional y Silenciosa)**:
   - Para conectar Gemini 2.5 Flash de forma transparente, abre la URL pasando tu clave:  
     `https://julio242023.github.io/Talent-Succession-Intelligence/?key=TU_GEMINI_API_KEY`  
     *(Se almacena silenciosamente en `localStorage` sin exponer campos técnicos en la interfaz)*.
   - Si no se proporciona clave, el sistema responde automáticamente con su motor analítico RAG local.
