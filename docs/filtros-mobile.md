## Rediseño de filtros (móvil/tablet)

### Problemas detectados en el diseño anterior (móvil)
- Densidad alta de “chips” en una sola caja: textos pequeños, saltos de línea impredecibles y dificultad para usar con una mano.
- Targets táctiles por debajo de lo recomendado (44x44px): mayor probabilidad de taps erróneos.
- Jerarquía visual poco clara: “Estado/Categoría/Fecha” compiten en el mismo nivel y no se entiende qué está activo rápidamente.
- El listado de actividades en formato tabla no se adapta bien a pantallas estrechas: columnas comprimidas y lectura difícil.

### Nuevo enfoque
- En pantallas estrechas (`<= 1023px`), los filtros se agrupan en un botón único **Filtros** que abre un **panel inferior (sheet)**.
- En pantallas grandes, se conserva la UI “Filtros avanzados” existente.
- En móvil/tablet, el listado cambia a **tarjetas** (card list) para mejorar legibilidad y evitar scroll horizontal.

### Breakpoints
- Compacto (móvil/tablet): `max-width: 1023px`
- Escritorio: `>= 1024px`

### Mockups (antes / después)

**Antes (móvil)**
```
Actividades recientes  [Filtros activos]
┌─────────────────────────────────────────┐
│ Filtros avanzados •                     │
│ ESTADO: [Pendiente][En revisión]...[ ]  │
│ CATEGORÍA: [Vencido][Por vencer]...[ ]  │
│ FECHA: [Todas][7d][30d][90d]            │
│ [Limpiar filtros]                       │
└─────────────────────────────────────────┘

Tabla (6 columnas) comprimida
```

**Después (móvil/tablet)**
```
Actividades recientes  [Filtros activos]  [Filtros (3)]

Sheet (panel inferior):
┌─────────────────────────────────────────┐
│ Filtros                                 │
│ [Estado: En revisión] [Fecha: 7 días]   │
│                                         │
│ Estado   (Abrir/Cerrar)                 │
│   [Pendiente]                           │
│   [En revisión] (activo)                │
│   [Rechazada]                           │
│   [Aprobada]                            │
│                                         │
│ Categoría (Abrir/Cerrar)                │
│   [Vencido] [Por vencer] [Cumplido]     │
│                                         │
│ Fecha    (Abrir/Cerrar)                 │
│   [Todas] [7 días] [30 días] [90 días]  │
│                                         │
│ [Limpiar]                 [Ver resultados]
└─────────────────────────────────────────┘

Listado en tarjetas:
┌─────────────────────────────────────────┐
│ Título (16px+)                          │
│ Empresa                                 │
│ [Prioridad] [Estado]  Asignado: ...     │
│ Acciones                                │
└─────────────────────────────────────────┘
```

### Especificaciones técnicas
- Targets táctiles:
  - Botón “Filtros” y opciones dentro del sheet: `min-height: 44px` (`min-h-11`).
- Tipografía:
  - Entradas y controles en móvil: mínimo `16px` (`text-base`).
  - Secciones y botones en sheet: `text-base`.
- Estados visuales:
  - Opción activa: fondo dorado `#D4AF37`, texto negro, borde dorado.
  - Opción inactiva: fondo blanco, borde gris claro.
- Transiciones:
  - Apertura/cierre del sheet: `~320–380ms`.
  - Expandir/colapsar secciones: `~300–360ms` con `transition-all`.
- Contraste:
  - Texto principal `text-slate-950` sobre fondo blanco.
  - Botones activos con texto negro sobre dorado.

### Archivos involucrados
- UI y layout de filtros + listado responsive: [activity-list.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/components/activities/activity-list.tsx)

### Checklist de pruebas (iOS / Android)
Probar en `320px`, `375px`, `414px`, `768px`, `834px`:
- El botón **Filtros** es accesible con el pulgar y abre/cierra correctamente.
- Las secciones expanden/colapsan con animación fluida.
- Seleccionar opciones refleja estado visual (activo/inactivo).
- “Limpiar” desactiva correctamente filtros activos.
- Listado de actividades en tarjetas mantiene legibilidad sin zoom.
- No hay overlays persistentes que bloqueen scroll del contenido.

