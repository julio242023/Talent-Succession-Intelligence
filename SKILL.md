---
name: centria-ui-design-system
description: >-
  Guía maestra de diseño, tokens de color, maquetación y auditoría de UI/UX para las aplicaciones de Centria y la Biblioteca Ejecutiva Breca (BEP).
  Utilizar siempre que se diseñe, revise, audite o implemente interfaces web, componentes visuales, colores, tipografía, layouts o flujos responsivos en este ecosistema.
---

# 🎨 Centria & Breca UI Design System

Este skill define los estándares oficiales de **Look and Feel**, jerarquía visual, paleta cromática, espaciado responsivo y accesibilidad para el ecosistema digital de **Centria** y la **Biblioteca Ejecutiva Breca (BEP)**.

---

## 🏛️ 1. Identidad Visual y Filosofía de Diseño

El diseño de Centria / Breca se rige por tres principios fundamentales:
1. **Sobriedad Ejecutiva y Autoridad:** Inspirado en el liderazgo corporativo del Grupo Breca. Predominan los fondos limpios (`slate-50`), superficies blancas inmaculadas con bordes sutiles y contraste de azul marino profundo (`#0B2545`).
2. **Claridad Operativa y Cero Fricción:** Información jerarquizada, tipografía balanceada (`text-wrap: balance`), sin elementos distractores ni sobrecarga visual.
3. **Mobile-First & Touch Accessibility:** Todas las interacciones deben responder con feedback inmediato (animaciones suaves, toques mínimos de 44×44px, navegación accesible por teclado y lectores de pantalla).

---

## 🎨 2. Paleta Oficial de Colores y Tokens

### A. Colores de Marca (Brand Colors)
| Token Semántico | Valor Hex | Clase Tailwind / CSS | Propósito |
| :--- | :--- | :--- | :--- |
| **Brand Navy (Primario)** | `#0B2545` | `text-[#0B2545]`, `bg-[#0B2545]` | Headers, títulos institucionales, botones de módulo activo, covers de tarjetas. |
| **Brand Blue (Acción)** | `#2563eb` | `bg-blue-600`, `text-blue-600` | Botones de acción primaria, enlaces activos, foco de inputs y hover states. |
| **Brand Accent (Luz)** | `#3b82f6` | `bg-blue-500`, `text-blue-500` | Subtítulos de logo, detalles de acento y bordes interactivos. |
| **Brand Magenta (Acento / Logro)** | `#C2185B` | `bg-[#C2185B]`, `text-[#C2185B]` | Insignia de favoritos, barras de progreso de reproducción, módulo B. |

### B. Estados y Semántica Operativa
| Estado | Color Hex | Badge / Pill | Propósito |
| :--- | :--- | :--- | :--- |
| **Éxito (Success)** | `#10b981` / `#047857` | `bg-emerald-50 text-emerald-700 border-emerald-200` | Sesiones completadas, métricas positivas, PWA instalada, conexión online. |
| **Alerta / Progreso** | `#f59e0b` / `#d97706` | `bg-amber-50 text-amber-700 border-amber-200` | Certificados pendientes, sesiones en curso, recursos de lectura. |
| **Error / Peligro** | `#ef4444` / `#dc2626` | `bg-red-50 text-red-700 border-red-200` | Eliminación, errores de red, campos inválidos. |
| **Neutro / Información** | `#64748b` | `bg-slate-100 text-slate-700 border-slate-200` | Metadatos secundarios, fechas, duraciones de archivo. |

### C. Superficies, Fondos y Texto
- **Fondo de Aplicación (`bep-app`):** `#f8fafc` (`slate-50`)
- **Fondo de Tarjetas (`bep-card`):** `#ffffff` (`white`) con `border border-slate-200` y `shadow-sm`
- **Texto Principal:** `#0f172a` (`slate-900`) — Contraste mínimo 7:1 sobre fondo claro.
- **Texto Secundario:** `#64748b` (`slate-500`) — Contraste mínimo 4.5:1.
- **Líneas Divisorias:** `#e2e8f0` (`slate-200`) o `#f1f5f9` (`slate-100`).

---

## 📐 3. Disposición y Jerarquía de Componentes (Layout Patterns)

### 1. Barra de Navegación Superior (`Header`)
- **Contenedor:** `sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm h-14`.
- **Estructura:**
  - **Izquierda:** Logo corporativo (`bep-logo`) con isotipo redondeado de 32×32px o imagen `breca-logo.jpg`.
  - **Centro:** Barra de búsqueda contenida (`max-w-xs lg:max-w-sm`) con ícono de lupa a la izquierda y botón "Limpiar" a la derecha. Oculta en móviles para evitar saturación (disponible en drawer).
  - **Derecha:** Acciones rápidas (Favoritos con badge numérico, botones de rol Admin y botón de perfil/logout).

### 2. Banner de Cabecera (`HeroBanner`)
- **Altura mínima:** `190px` en móvil, `220px` en escritorio.
- **Composición:** Imagen de fondo corporativa con degradado superpuesto `linear-gradient(to right, rgba(11,37,69,0.98) 0%, rgba(11,37,69,0.7) 100%)`.
- **Tipografía:** Título en blanco `font-black text-2xl sm:text-3xl` con acento en azul cielo.
- **Controles flotantes:** Cualquier botón de configuración administrativa (ej. *"Configurar Anuncio"*) debe ubicarse en la esquina superior derecha con fondo semitransparente `backdrop-blur-md` y target táctil accesible.

### 3. Barra de Filtrado (`FilterBar`)
- **Fila de Módulos:** Pills compactos con scroll horizontal sin barra visible (`no-scrollbar`) en dispositivos móviles, permitiendo navegación táctil rápida sin saltos de línea.
- **Controles Secundarios:** Selects desplegables nativos estilizados (`bep-select`) para formatos y orden cronológico.
- **Contador:** Badge corporativo `bep-badge-navy` indicando el total exacto de resultados.

### 4. Tarjetas de Contenido (`SessionCard`)
- **Estructura:**
  - **Cover Strip:** Altura de 80px (`5rem`) con gradiente Navy (`#0B2545` a `#1a3a62`), código de módulo en marca de agua tipográfica (`font-black opacity-10`) y badge de módulo centrado.
  - **Barra de Progreso:** Si el usuario tiene avance, franja inferior de 3px con gradiente `#C2185B` a rosa.
  - **Cuerpo:** Fecha con ícono, chips de formatos presentes (video, lectura, presentación), título a 2 líneas con ellipsis (`line-clamp-2`), expositor y botón de acción.
  - **Acciones Táctiles:** En móviles, no depender de `group-hover`. Las acciones de edición/favorito deben ser accesibles directamente o mediante un menú contextual de 3 puntos.

### 5. Modales y Visores Integrados
- **Backdrop:** `bg-black/60 backdrop-blur-sm fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4`.
- **Cuerpo:** Tarjeta blanca redondeada (`rounded-2xl`), scroll interno suave, cabecera fija con botón de cierre `44×44px` claramente visible.
- **Acordeones:** Agrupación limpia por tipo de recurso (`AccordionGroup`) con contador y chevron animado.

---

## 🚫 4. Reglas Estrictas y Anti-Patrones (Design Guardrails)

1. **CERO Estilos Inline Arbitrarios:**
   - ❌ **Evitar:** `style={{ color: '#38bdf8' }}` o `style={{ background: '#C2185B' }}`
   - ✅ **Usar:** Clases utilitarias o tokens de `@theme` (ej. `text-sky-400`, `bg-[#C2185B]` o variables CSS dedicadas).
2. **Touch Targets de 44×44px (WCAG 2.5.5):**
   - Todo botón, enlace o elemento interactivo debe tener un área mínima de toque de 44×44 píxeles en vista móvil.
3. **No Depender Exclusivamente de Hover:**
   - Las acciones clave (como borrar, editar o marcar favorito) nunca deben estar ocultas permanentemente en interfaces táctiles tras un `hover`.
4. **Legibilidad y Contraste (WCAG 2.1 AA):**
   - El texto sobre fondos oscuros (como en el Hero o Cover Strip) debe ser blanco o `slate-200`.
   - El texto secundario sobre fondo blanco debe ser mínimo `slate-500` (`#64748b`), nunca más claro.
5. **No Duplicar Bloques de CSS:**
   - Mantener [`index.css`](file:///c:/Users/sky_c/Downloads/Centria%20Biblioteca%20Corp/Centria%20Biblioteca%20Corp/frontend/src/index.css) limpio, sin repetir animaciones ni definiciones de clases de componentes.

---

## 📋 5. Checklist de Auditoría de Look and Feel

Al revisar cualquier componente o pantalla nueva, verificar obligatoriamente:

- [ ] **1. Consistencia Cromática:** ¿Usa únicamente colores de la paleta oficial (Navy `#0B2545`, Blue `#2563eb`, Magenta `#C2185B`, Emerald, Slate)?
- [ ] **2. Balance Tipográfico:** ¿Los encabezados usan `text-wrap: balance` y los párrafos `text-wrap: pretty`?
- [ ] **3. Responsive Check:**
  - Móvil (<640px): ¿Cero scroll horizontal no deseado? ¿Touch targets cómodos?
  - Tablet (640px - 1024px): ¿Grid de 2 columnas fluido?
  - Desktop (>1024px): ¿Contenedores centrados con `max-w-7xl`?
- [ ] **4. Feedback Visual:** ¿Hay estados `:hover`, `:focus-visible` y `:active` para cada botón?
- [ ] **5. Estado de Carga y Vacío:** ¿Tiene un skeleton shimmer (`bep-shimmer`) o empty state ilustrado en caso de 0 resultados?
- [ ] **6. Accesibilidad:** ¿Las imágenes tienen `alt` descriptivo? ¿Los botones sin texto tienen `aria-label` o `title`?
