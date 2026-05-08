## Rediseño del dashboard (móvil)

### Objetivo
Transformar el dashboard en móvil/tablet vertical en una experiencia:
- Intuitiva (acciones principales visibles, secundarias dentro de paneles).
- Accesible (targets táctiles ≥ 44px, tipografía ≥ 16px, estados claros).
- Optimizada para uso con una sola mano (controles arriba mínimos + navegación inferior).

### Problemas del diseño anterior (móvil)
- Demasiados controles visibles a la vez (filtros + tabs + gráficas + métricas), lo que aumenta carga cognitiva y scroll.
- Controles pequeños (h-8, text-xs) difíciles de usar con el pulgar.
- Contenido clave (KPIs) no priorizado y la información crítica queda “enterrada”.
- Tablas/gráficas pesadas visibles de inmediato, afectando performance y legibilidad.

### Solución implementada
En `<= 1023px`:
- Se reemplaza la cabecera compleja del dashboard por:
  - Un bloque de KPIs en tarjetas grandes.
  - Un botón único **Filtros** que abre un **panel inferior** (sheet) con todos los controles.
  - Secciones colapsables para **Gráficas** y **Métricas por empresa**.
- Se agrega navegación inferior fija para facilitar acceso rápido a secciones principales.

En `>= 1024px`:
- Se mantiene el dashboard original (sin cambios de layout), solo se agrega la tarjeta de **Rechazadas** en KPIs.

### Breakpoints
- Dashboard móvil/tablet: `max-width: 1023px`
- Dashboard escritorio: `>= 1024px`

### Componentes involucrados
- Lógica y UI principal: [overview-content.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/components/dashboard/overview-content.tsx)
- KPI “Rechazadas” (count server): [overview/page.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/app/(dashboard)/overview/page.tsx)
- Navegación inferior móvil: [mobile-bottom-nav.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/components/dashboard/mobile-bottom-nav.tsx)
- Integración en layout + padding inferior: [layout.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/app/(dashboard)/layout.tsx)

### KPI “Rechazadas”
- Se agrega un KPI dedicado que muestra el total de actividades en estado `REJECTED`.
- Acción: navegación rápida a `/activities?status=REJECTED` (preserva `companyId` si aplica).

### Accesibilidad y usabilidad
- Targets táctiles:
  - Botones principales y opciones en filtros: `min-h-11` (≥ 44px).
- Tipografía:
  - Controles y texto principal en móvil: `text-base` (≥ 16px).
- Estados:
  - Opción activa usa dorado `#D4AF37` + texto negro para contraste alto.
- Cierre del panel de filtros:
  - Tap fuera del panel.
  - Swipe hacia abajo (umbral ~70px).

### Mockups (antes / después)

**Antes (móvil)**
```
KPIs + panel complejo (muchos controles visibles)
[tabs] [selects] [fechas] [gráficas] [resúmenes]
```

**Después (móvil/tablet)**
```
Resumen rápido
[Filtros (N)]

[KPIs en tarjetas grandes]
[Rechazadas (nuevo)]

[Indicadores tácticos]
[Gráficas (colapsable)]
[Métricas por empresa (colapsable)]

Barra inferior: Inicio | Actividades | Empresas | Ayuda
```

### Plan de pruebas (manual iOS/Android)
Probar en `320px`, `375px`, `414px`, `768px`, `834px`:
- KPIs legibles sin zoom y clicables con el pulgar.
- Panel de filtros abre/cierra y no bloquea scroll del contenido.
- Secciones “Gráficas” y “Métricas por empresa” expanden/colapsan con animación fluida.
- Navegación inferior no tapa contenido (padding inferior aplicado).

### Plan de pruebas con usuarios reales (medición 40%)
No se automatiza desde código. Recomendación:
- Definir 3 tareas típicas (ej: “ver rechazadas”, “filtrar por empresa”, “exportar PDF”).
- Medir:
  - Tiempo a completitud (pre/post).
  - Errores (taps erróneos / navegación incorrecta).
  - Satisfacción (SUS o encuesta de 1–5).
- Objetivo: reducción ≥ 40% en tiempo promedio y aumento en satisfacción.

