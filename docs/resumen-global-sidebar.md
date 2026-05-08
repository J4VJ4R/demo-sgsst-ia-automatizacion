# Sidebar “Resumen Global” (RBAC + Persistencia)

## Objetivo
Habilitar el sidebar derecho “Resumen Global” para los roles:

- ADMIN_PMD
- CONSULTANT
- CLIENT
- CLIENT_VIEWER

Y bloquearlo para cualquier otro rol.

## Rutas impactadas
- Layout del dashboard: `/app/(dashboard)/*` (se renderiza dentro del layout, por lo que aparece en las páginas del dashboard, incluyendo `/activities`).

## Persistencia de visibilidad
- La expansión/colapso del sidebar se persiste en `localStorage` con la clave `globalSummaryCollapsed` (se respeta la clave previa `clientSummaryCollapsed` como fallback de lectura).

## Backend (validación y datos)
- Se implementa `getGlobalActivitySummary({ companyId })` para calcular conteos por estado y vencimientos según el rol autenticado y la empresa seleccionada.
- Se mantiene `getClientActivitySummary()` como alias para compatibilidad.

## Archivos modificados / agregados
- UI
  - [layout.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/app/(dashboard)/layout.tsx)
  - [global-summary-gate.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/components/dashboard/global-summary-gate.tsx)
  - [client-activity-summary.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/components/dashboard/client-activity-summary.tsx)
  - [sidebar.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/components/dashboard/sidebar.tsx)
- Backend
  - [summary-actions.ts](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/app/actions/summary-actions.ts)
- RBAC
  - [rbac.ts](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/lib/rbac.ts)
- Tests
  - [rbac-global-summary.test.ts](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/lib/__tests__/rbac-global-summary.test.ts)
  - [global-summary-gate.test.tsx](file:///c:/Users/USER/Desktop/PROJECTS/pmd-servicios-dashboard/pmd-dashboard/components/dashboard/__tests__/global-summary-gate.test.tsx)

