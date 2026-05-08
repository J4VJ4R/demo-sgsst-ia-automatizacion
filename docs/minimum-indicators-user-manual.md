# Indicadores mínimos — Manual de usuario

## Acceso al módulo
- En una empresa (Proyecto), activa la sección **Indicadores mínimos** desde **Gestión**.
- Entra a la sección **Indicadores mínimos**.

Roles:
- **Consultor / Admin PMD**: puede crear indicadores, configurar fórmulas y cargar datos por periodo.
- **Cliente**: solo visualiza (sin edición ni carga de datos).

## 1) Crear un indicador
1. En **Indicadores mínimos**, pulsa **Nuevo indicador**.
2. Completa:
   - **Nombre del indicador**
   - **Descripción** (opcional)
   - **Tipo** (opcional, para filtros)
   - **Unidad de medida** (ej. `%`, `días`, etc.)
   - **Periodicidad** (ej. Mensual)
   - **Meta (%)**
3. Define variables:
   - Agrega variables (ej. `Días por accidente`, `Días trabajados`).
   - La clave se genera automáticamente (ej. `dias_por_accidente`).
4. Define la fórmula:
   - Escribe la fórmula usando `+ - * /` y paréntesis.
   - Inserta variables desde la lista para evitar errores.
   - Ejemplo: `(dias_accidente / dias_trabajados) * 100`
5. Guarda.

## 2) Ver el detalle del indicador
- En la lista de indicadores, pulsa **Ver detalle**.
- Se muestra:
  - Estado de cumplimiento (semáforo)
  - Gráfico **Actual vs Meta**
  - Gráfico de **Cumplimiento**
  - Tendencia (alza/baja/estable)
  - Historial de mediciones

## 3) Cargar datos por periodo
1. En el detalle del indicador, en **Cargar datos por periodo**:
2. Selecciona **Periodo inicio** y **Periodo fin**.
3. Diligencia los valores de las variables.
4. Revisa la **previsualización** (valor calculado + cumplimiento).
5. Pulsa **Guardar medición**.

## 4) Configurar indicador (editar)
1. En el detalle del indicador, pulsa **Configurar**.
2. Ajusta nombre, meta, fórmula, etc.
3. Guarda.

## 5) Exportaciones
- En el detalle:
  - **Exportar PDF**: genera un PDF con la ficha y tabla de mediciones.
  - **Exportar Excel**: genera un `.xlsx` con el historial de mediciones.

