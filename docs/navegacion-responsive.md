## Navegación responsive (móvil / tablet)

### Objetivo
En móviles y tablets en orientación vertical, el sidebar fijo se reemplaza por un menú hamburguesa que abre un panel lateral (drawer) con todas las opciones de navegación. En pantallas grandes se mantiene el sidebar de escritorio.

### Breakpoints
- `< 1024px` (`lg`): se oculta el sidebar de escritorio y se habilita el botón hamburguesa en el topbar.
- `>= 1024px` (`lg`): se muestra el sidebar de escritorio y se oculta el botón hamburguesa.

### Comportamiento del menú hamburguesa
- Botón: aparece en el topbar en móvil/tablet, con área clicable `44x44` (clase `h-11 w-11`).
- Apertura: despliega un panel lateral desde la izquierda con overlay (clic fuera cierra).
- Cierre:
  - Clic/tap fuera del panel (overlay).
  - Tecla `Esc`.
  - Swipe hacia la izquierda (en touch) con umbral aproximado de `70px`.

### Ancho del panel
Se ajusta por viewport:
- Móvil: `80vw` (≤ 639px).
- Móvil grande: `70vw` (≥ 640px y < 768px).
- Tablet: `45vw` (≥ 768px y < 1024px).

### Tipografía y accesibilidad
- Tamaños:
  - Móvil: `16px` (clase `text-base`).
  - Tablet: `18px` (clase `md:text-lg`).
- Targets táctiles:
  - Ítems y acciones: `min-h-11` (≥ 44px) y padding lateral suficiente.
- Enfoque visible:
  - `focus-visible:ring-2` con color de marca `#D4AF37`.

### Animaciones
- Se utilizan transiciones suaves basadas en `Sheet` (Radix) con:
  - Apertura: `400ms`.
  - Cierre: `320ms`.

### Fuente de verdad de items
Los ítems del menú están centralizados en:
- [navigation-items.ts](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/components/dashboard/navigation-items.ts)

Para agregar/reordenar/ocultar ítems:
- Editar `DASHBOARD_NAV_ITEMS` (título, ruta, roles y prioridad).
- El sidebar de escritorio y el menú móvil consumen la misma lista.

### Archivos involucrados
- Layout dashboard: [layout.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/app/(dashboard)/layout.tsx)
- Sidebar escritorio: [sidebar.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/components/dashboard/sidebar.tsx)
- Menú móvil (drawer): [mobile-nav-menu.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/components/dashboard/mobile-nav-menu.tsx)
- Topbar (incluye botón): [topbar.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/components/dashboard/topbar.tsx)

### Checklist de pruebas manuales
Probar en iOS y Android (Chrome/Safari) con estos anchos:
- `320px`, `375px`, `414px`, `768px`, `834px`

Validar:
- Textos legibles sin zoom (título y labels del menú).
- Botón hamburguesa y enlaces fáciles de pulsar con el pulgar (targets ≥ 44px).
- Overlay cierra al tocar fuera.
- Swipe hacia la izquierda cierra el panel.
- No se tapa contenido importante (drawer ocupa solo parte del viewport).

