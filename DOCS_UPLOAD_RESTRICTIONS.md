# Control de Carga de Archivos - Documentación

## Reglas de Negocio

El sistema implementa un control de estado dinámico para la carga de archivos en actividades, basado en la **prioridad** calculada a partir de la fecha de vencimiento.

### Estados de Prioridad y Permisos

| Prioridad | Días Restantes | Estado de Carga | Visualización |
|-----------|----------------|-----------------|---------------|
| **Cumplido** | > 30 días | **Deshabilitado** | Botón gris/inactivo con tooltip explicativo. |
| **Por vencer** | 16 - 30 días | **Habilitado** | Botón normal activo. |
| **Vencido** | <= 15 días | **Habilitado** | Botón normal activo. |

### Comportamiento del Sistema

1.  **Frontend (Panel de Consultor):**
    *   Al renderizar la tabla de actividades, el sistema evalúa la prioridad de cada actividad.
    *   Si la prioridad es "Cumplido" (verde), el botón "Carga de archivo" se muestra deshabilitado.
    *   Al pasar el mouse sobre el botón deshabilitado, se muestra el mensaje: *"La carga no está disponible porque el plazo aún no ha vencido (Prioridad: Cumplido)."*

2.  **Backend (API/Servidor):**
    *   Cada intento de carga (`uploadActivityFile` o `createActivityUploadRequest`) valida nuevamente la fecha de vencimiento.
    *   Si un usuario intenta forzar la carga (ej. manipulando el frontend) para una actividad en estado "Cumplido", el servidor rechaza la solicitud.
    *   El intento bloqueado se registra en el historial de la actividad (`ActivityHistory`) con el campo `upload_attempt_blocked`.

3.  **Automatización:**
    *   El estado se recalcula automáticamente basado en la fecha actual. No se requiere intervención del administrador para habilitar la carga cuando el plazo se acerca (entra en rango "Por vencer").

## Manual de Usuario (Extracto)

### Gestión de Archivos

El botón de **"Carga de archivo"** o **"Agregar archivo"** puede aparecer en dos estados:

*   **Activo (Normal):** Puede subir archivos. Esto indica que la actividad está próxima a vencer (menos de 30 días) o ya está vencida.
*   **Inactivo (Gris):** No puede subir archivos. Esto ocurre cuando la fecha de vencimiento es lejana (más de 30 días, estado "Cumplido"). El sistema restringe la carga anticipada para asegurar que la evidencia corresponda al periodo correcto.

*Nota: Si necesita subir un archivo urgente en una actividad con plazo lejano, contacte al administrador para ajustar la fecha de vencimiento.*
