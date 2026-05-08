# Indicadores mínimos — Documentación técnica

## Objetivo
Módulo por empresa (Proyecto) para:
- Definir indicadores con meta (%) y fórmula.
- Cargar mediciones por periodo con variables numéricas.
- Calcular resultados en tiempo real y persistir mediciones.
- Visualizar con gráficos y exportar a PDF/Excel.

## Modelo de datos (Prisma)
Archivos:
- [schema.prisma](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/prisma/schema.prisma)

Tablas nuevas:
- `minimum_indicator`
  - `projectId` (FK a Project)
  - `name`, `description`, `type`
  - `unit`, `periodicity`
  - `targetPercent`
  - `formula`
  - `variablesJson` (JSON serializado; lista `{ key, label }`)
- `minimum_indicator_measurement`
  - `indicatorId` (FK a MinimumIndicator)
  - `periodStart`, `periodEnd`
  - `inputsJson` (JSON serializado; `{ [key]: number }`)
  - `computedValue`
  - `compliancePct` (computedValue / targetPercent * 100)
  - `createdByUserId` (FK a User)

Notas:
- `deletedAt` está preparado para soft delete en futuros cambios.
- Se limitan lecturas a 100 mediciones por indicador para evitar degradación.

## Cálculo y validación de fórmulas
Archivo:
- [minimum-indicators-formula.ts](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/lib/minimum-indicators-formula.ts)

Características:
- Tokenización y validación sintáctica con operadores `+ - * /` y paréntesis.
- Variables con formato `snake_case` (`sanitizeVariableKey`).
- Evaluación segura (sin `eval`) mediante conversión a RPN.
- Errores controlados: sintaxis inválida, variable sin valor, división por cero.

## API / Server Actions
Archivo:
- [minimum-indicators-actions.ts](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/app/minimum-indicators-actions.ts)

Funciones principales:
- `listMinimumIndicators({ projectId, ... })`
- `createMinimumIndicator(formData)`
- `updateMinimumIndicator(formData)`
- `getMinimumIndicatorDetail({ projectId, indicatorId })`
- `createMinimumIndicatorMeasurement(formData)`

Permisos:
- Admin PMD: ver/gestionar.
- Consultor asignado a la empresa: ver/gestionar.
- Cliente: solo ver.

## UI y navegación
Lista (dentro de la empresa):
- Sección: `?view=minimum-indicators`
- Componente: [minimum-indicators-manager.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/components/minimum-indicators/minimum-indicators-manager.tsx)
- Creación: [minimum-indicator-create-dialog.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/components/minimum-indicators/minimum-indicator-create-dialog.tsx)

Detalle:
- Ruta: `/projects/[id]/minimum-indicators/[indicatorId]`
- Página: [page.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/app/(dashboard)/projects/%5Bid%5D/minimum-indicators/%5BindicatorId%5D/page.tsx)
- UI: [minimum-indicator-detail-client.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/components/minimum-indicators/minimum-indicator-detail-client.tsx)

Gráficos:
- Recharts (responsive): barras (actual vs meta) y torta (cumplimiento).

Exportaciones:
- Excel: `xlsx`
- PDF: `jspdf` + `jspdf-autotable`

## Pruebas
Archivo:
- [minimum-indicators-formula.test.ts](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/lib/__tests__/minimum-indicators-formula.test.ts)

Ejecutar:
- `npx vitest run`

## Migraciones
El esquema Prisma fue extendido para el módulo. Si el entorno presenta drift de migraciones, se recomienda alinear el historial local con la base de datos antes de ejecutar `prisma migrate dev`.

