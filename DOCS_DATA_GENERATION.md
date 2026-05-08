# Generación de Datos de Prueba

Para garantizar que el sistema muestre métricas coherentes y realistas en los entornos de desarrollo y demostración, se ha creado un script de generación de datos (`scripts/seed-real-data.ts`).

## Propósito

Este script tiene dos funciones principales:
1.  **Poblar empresas vacías:** Si una empresa tiene menos de 5 actividades, se le generan 12 actividades nuevas con datos realistas.
2.  **Reparar datos existentes:** Si una empresa ya tiene actividades, el script actualiza sus fechas de vencimiento y estados para alinearlos con la lógica de negocio actual, asegurando una distribución variada de prioridades (Vencido, Por Vencer, Cumplido).

## Lógica de Distribución

El script distribuye las actividades de la siguiente manera para simular un escenario real:

*   **~33% Vencidas (Alta Prioridad):**
    *   Estado: `PENDING`
    *   Fecha de vencimiento: Entre hace 5 días y dentro de 10 días (siempre <= 15 días restantes).
*   **~33% Por Vencer (Media Prioridad):**
    *   Estado: `PENDING`
    *   Fecha de vencimiento: Entre 16 y 30 días a partir de hoy.
*   **~34% Cumplidas (Baja Prioridad):**
    *   Mitad `APPROVED` (fecha pasada).
    *   Mitad `PENDING` con fecha lejana (> 30 días).

## Ejecución

Para regenerar o reparar los datos en cualquier momento, ejecute el siguiente comando desde la raíz del proyecto:

```bash
npx tsx scripts/seed-real-data.ts
```

Esto iterará sobre todas las empresas registradas en la base de datos y aplicará la lógica descrita anteriormente.
