# Centria | Talent & Succession Intelligence (Demo 2026)

Plataforma ejecutiva interactiva para la visualización, analítica y consulta asistida por Inteligencia Artificial del reporte corporativo de talento y sucesión (`2026_Reporte_Sucesion.xlsx` — **101 posiciones clave y 14 dimensiones de datos** en 12 unidades de negocio del Grupo Breca).

---

## ✨ Características Principales

1. **Dashboard Analítico Ejecutivo (Vista Inicial)**:
   - **4 KPIs Ejecutivos Dinámicos**: Posiciones evaluadas, Cobertura de Sucesión (%), Posiciones con Sucesión Inmediata (*Ready Now*) y Alertas Críticas (Riesgo Alto sin sucesor).
   - **Matriz 9-Box Interactiva**: Visualización de los 9 cuadrantes de potencial y desempeño con porcentajes, conteo de talentos y filtro a un solo clic.
   - **Riesgo de Pérdida y Horizonte de Readiness**: Desglose con barras proporcionales y alertas de retención prioritarias para el Comité de Talento.
   - **Benchmark por Unidad de Negocio**: Comparativo de cobertura en las 12 empresas (*Centria, Qroma, Aporta, Corporación Breca, Minsur, Tasa, Clínica Internacional, Rimac, Intursa, Urbanova, Aesa y Melón*).

2. **Agente IA de Talento (Chat Flotante FAB)**:
   - **Asistente Conversacional no Invasivo**: Botón flotante en la esquina inferior derecha con cajón lateral (Drawer) expansible, botón de minimizar (`—`), nueva sesión y cierre.
   - **Acciones Rápidas (1 Clic)**: 6 tarjetas de preguntas frecuentes de alta prioridad ejecutiva (fichas individuales, comparaciones cruzadas, alertas de retención, comités).
   - **Catálogo de Referencias**: 27 consultas organizadas por categorías de negocio para explorar el documento con un clic.
   - **Consultas Libres y Abiertas**: Responde cualquier pregunta en lenguaje natural sobre las 101 posiciones, nombres, DNIs, roles, niveles (`N-1`, `N-2`), grados `GGS`, sucesores y riesgos.
   - **Lógica Híbrida Inteligente**: RAG en memoria con segmentación de contexto (*slicing*) para minimizar el consumo de tokens en Gemini y respuestas en HTML estructurado de alta fidelidad visual.

3. **Directorio y Gestión de Datos (Excel CRUD)**:
   - Importación y exportación reactiva de archivos `.xlsx` vía **SheetJS**.
   - Búsqueda global, filtros por empresa y edición/registro de nuevos colaboradores.

---

## 🚀 Despliegue en GitHub Pages (100% Estático y Autónomo)

La solución está construida para ejecutarse directamente en **GitHub Pages** sin necesidad de desplegar servidores backend:

1. **Inicializar y subir a tu repositorio en GitHub**:
   ```bash
   git add .
   git commit -m "feat: Centria Talent & Succession Intelligence Demo"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/<tu-repositorio>.git
   git push -u origin main
   ```
   *(El archivo `.gitignore` protege automáticamente claves privadas y archivos locales como `google_credentials.json` y `config.json`)*.

2. **Activar GitHub Pages**:
   - En tu repositorio de GitHub, dirígete a **Settings → Pages**.
   - En la sección **Build and deployment → Source**, selecciona **Deploy from a branch**.
   - Selecciona la rama `main` y la carpeta `/ (root)`. Guarda los cambios.

3. **Acceder a la Demo Web**:
   - En 1-2 minutos, tu demo estará disponible en:
     **https://julio242023.github.io/Talent-Succession-Intelligence/**
   - El dataset completo de 101 posiciones y el Agente IA cliente funcionarán de forma reactiva en el navegador.

---

## 💻 Ejecución Local con Backend Python (FastAPI + Gemini 2.5 Flash)

Si deseas ejecutar el servidor local FastAPI conectado al motor de **Gemini 2.5 Flash (Proyecto Nexxia)** con Vertex AI o API Key:

1. **Instalar dependencias**:
   ```bash
   pip install fastapi uvicorn openpyxl requests google-auth
   ```

2. **Configurar Credenciales (Opcional si usas API Key o Service Account)**:
   - Copia `config.example.json` a `config.json` e ingresa tu clave de Gemini:
     ```json
     {
       "active_provider": "google",
       "GEMINI_API_KEY": "AIzaSy...",
       "GCP_PROJECT": "core-agentspace-prd",
       "GCP_LOCATION": "us-central1",
       "GEMINI_MODEL": "gemini-2.5-flash"
     }
     ```

3. **Iniciar el Servidor**:
   ```bash
   python -m uvicorn server:app --host 127.0.0.1 --port 8000
   ```

4. **Abrir en el Navegador**:
   - Accede a: `http://127.0.0.1:8000`

---

## 📁 Arquitectura de Archivos

```
├── .gitignore                    # Reglas de exclusión para Git (credenciales protegidas)
├── 2026_Reporte_Sucesion.xlsx    # Archivo maestro de talento y sucesión (101 registros)
├── index.html                    # Punto de entrada para despliegue en GitHub Pages (root)
├── config.example.json           # Plantilla de configuración segura de ejemplo
├── README.md                     # Documentación ejecutiva del proyecto
├── server.py                     # Servidor backend FastAPI (recicla conector Nexxia)
├── SKILL.md                      # Especificación del Design System Centria / Breca
├── utils/
│   ├── excel_loader.py           # Parser y normalizador de datos del Excel
│   └── call_llm.py               # RAG en memoria con segmentación de contexto y cliente Gemini
└── web/
    ├── index.html                # Interfaz web ejecutiva
    ├── style.css                 # Tokens de diseño Centria, layouts y componentes
    ├── initial-data.js           # Dataset de 101 posiciones serializado para modo estático
    ├── client-agent.js           # Agente IA del lado del cliente (autónomo para GitHub Pages)
    └── app.js                    # Controlador de estado reactivo, gráficos y chat
```

---

## 🛡️ Seguridad y Buenas Prácticas
- **Cero Fuga de Credenciales**: Las claves de servicio de Google Cloud y llaves de API están excluidas por `.gitignore`.
- **Diseño Ejecutivo Centria**: Cumple con la paleta `#0B2545` (Navy Centria), `#2563EB` (Cobalto), `#F4F6F8` (Fondo Neutro) y contraste accesible WCAG AA.
- **RAG con Reducción de Tokens**: El motor filtra y segmenta los registros pertinentes antes de enviar el prompt al LLM, reduciendo el consumo entre un 80% y 98%.
