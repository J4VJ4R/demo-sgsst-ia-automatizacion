import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Settings, 
  ShieldCheck, 
  FolderOpen,
  UserPlus,
  Bell,
  Search,
  HelpCircle,
  Activity,
  Briefcase
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type HelpCategory = "General" | "Administración" | "Proyectos" | "Actividades" | "Documentos" | "Usuarios" | "Configuración";

export type HelpArticle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: HelpCategory;
  tags: string[];
  roles: string[]; // 'ADMIN_PMD', 'CONSULTANT', 'CLIENT_VIEWER'
  content: string; // Markdown content
  videoUrl?: string;
  updatedAt: string;
  icon?: LucideIcon;
  relatedArticles?: string[]; // IDs of related articles
};

export const helpCategories: { id: HelpCategory; label: string; icon: LucideIcon; description: string }[] = [
  { id: "General", label: "Primeros Pasos", icon: LayoutDashboard, description: "Conceptos básicos y navegación" },
  { id: "Administración", label: "Administración", icon: ShieldCheck, description: "Gestión del sistema y seguridad" },
  { id: "Proyectos", label: "Empresas y Proyectos", icon: Briefcase, description: "Gestión de clientes y sedes" },
  { id: "Actividades", label: "Actividades SST", icon: Activity, description: "Cronograma y cumplimiento" },
  { id: "Documentos", label: "Gestión Documental", icon: FolderOpen, description: "Archivos y versiones" },
  { id: "Usuarios", label: "Usuarios y Colaboradores", icon: Users, description: "Accesos y perfiles" },
  { id: "Configuración", label: "Configuración", icon: Settings, description: "Ajustes de cuenta y sistema" },
];

export const helpArticles: HelpArticle[] = [
  // --- GENERAL ---
  {
    id: "gen-001",
    slug: "introduccion-plataforma",
    title: "Bienvenido a PMD Servicios Dashboard",
    description: "Visión general de la plataforma y cómo navegar por el panel de control.",
    category: "General",
    tags: ["inicio", "navegación", "interfaz"],
    roles: ['ADMIN_PMD', 'CONSULTANT', 'CLIENT_VIEWER'],
    updatedAt: "2026-03-01",
    icon: LayoutDashboard,
    content: `
# Bienvenido al Ecosistema PMD

Esta plataforma integral ha sido diseñada para optimizar la gestión de Seguridad y Salud en el Trabajo (SST), permitiendo un control centralizado de empresas, proyectos y cumplimiento normativo.

## ¿Qué puede hacer aquí?

### 1. Panel de Control (Dashboard)
Su centro de mando. Aquí visualizará indicadores clave de rendimiento (KPIs) en tiempo real:
- Estado de actividades (Pendientes, En Proceso, Vencidas).
- Cumplimiento global por empresa.
- Alertas críticas.

### 2. Navegación Principal
El menú lateral es su herramienta principal de navegación. Dependiendo de su rol, verá:
- **Resumen**: Vista general de indicadores.
- **Empresas**: Gestión de clientes y proyectos asignados.
- **Actividades**: Cronograma de tareas y obligaciones.
- **Usuarios**: (Solo Admin) Gestión de accesos.
- **Configuración**: Ajustes de su perfil.

### 3. Roles de Usuario
- **Administrador**: Control total del sistema.
- **Consultor**: Gestión operativa de proyectos asignados.
- **Cliente**: Visualización de estado y descarga de informes.

> **Consejo Pro**: Utilice el botón de colapsar en el menú lateral para ganar más espacio de trabajo en pantallas pequeñas.

[Ver Video Tutorial: Recorrido por la Interfaz](https://www.youtube.com/watch?v=placeholder)
    `,
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" // Placeholder
  },

  // --- PROYECTOS / EMPRESAS ---
  {
    id: "proj-001",
    slug: "gestion-empresas",
    title: "Gestión de Empresas y Proyectos",
    description: "Cómo crear, editar y supervisar empresas cliente.",
    category: "Proyectos",
    tags: ["empresas", "clientes", "creación"],
    roles: ['ADMIN_PMD', 'CONSULTANT'],
    updatedAt: "2026-02-15",
    icon: Briefcase,
    content: `
# Gestión de Empresas

El módulo de Empresas es el núcleo de la operación. Aquí se centraliza la información de cada cliente.

## Crear una Nueva Empresa
*(Solo Administradores)*

1. Navegue a la sección **Empresas**.
2. Haga clic en el botón **"Nueva Empresa"** (icono +).
3. Complete el formulario con:
   - **NIT**: Identificación tributaria única.
   - **Razón Social**: Nombre legal.
   - **Consultor Asignado**: Profesional responsable.
   - **Ubicación**: Departamento y municipio.

## Visualización de Detalles

Al hacer clic en una empresa, accederá a su panel específico donde podrá ver:
- **Resumen de Cumplimiento**: Gráficos de estado.
- **Actividades Recientes**: Tareas asociadas a esta empresa.
- **Documentación**: Archivos específicos del cliente.

## Asignación de Consultores

Puede reasignar una empresa a otro consultor en cualquier momento desde la opción **Editar Empresa**. Esto transferirá automáticamente la visibilidad de las actividades pendientes.
    `
  },

  {
    id: "proj-002",
    slug: "seccion-accidentalidad",
    title: "Sección Accidentalidad (Empresa)",
    description: "Gestione evidencias y vencimientos de actividades de accidentalidad por empresa.",
    category: "Proyectos",
    tags: ["accidentalidad", "furat", "investigación", "evidencias"],
    roles: ["ADMIN_PMD", "CONSULTANT", "CLIENT", "CLIENT_VIEWER"],
    updatedAt: "2026-03-12",
    icon: FileText,
    content: `
# Sección Accidentalidad

La **Sección Accidentalidad** centraliza el seguimiento y carga de evidencias relacionadas con incidentes/accidentes por empresa.

## ¿Dónde encontrarla?

1. Ingrese a **Empresas** y seleccione una empresa.
2. En el menú izquierdo, sección **Gestión**, seleccione **Sección Accidentalidad**.

## ¿Qué incluye?
- Tabla responsive con: **Actividad**, **Fecha de Carga**, **Fecha de Vencimiento**, **Estado**, **Archivo Adjunto**, **Acciones**.
- Búsqueda por nombre de actividad.
- Filtros por **estado** (Vencido / Por vencer / Cumplido) y por rango de **fecha de vencimiento**.
- Acciones: **Editar**, **Eliminar**, **Ver historial**, **Descargar archivo**, **Cargar archivo**.

## Reglas de archivos
- Formatos permitidos: **PDF, DOC, DOCX, XLS, XLSX**.
- Tamaño máximo: **20MB** por archivo.

## Permisos (RBAC)
- **Administrador/Consultor**: puede editar, cargar y eliminar archivos.
- **Cliente**: visualiza y descarga evidencias (según asignación a la empresa).
    `
  },

  // --- ACTIVIDADES ---
  {
    id: "act-001",
    slug: "flujo-actividades",
    title: "Flujo de Trabajo de Actividades SST",
    description: "Entienda los estados de una actividad: Pendiente, En Revisión, Aprobada, Rechazada.",
    category: "Actividades",
    tags: ["estados", "flujo", "aprobación"],
    roles: ['ADMIN_PMD', 'CONSULTANT', 'CLIENT_VIEWER'],
    updatedAt: "2026-03-02",
    icon: Activity,
    content: `
# Ciclo de Vida de una Actividad

Cada tarea en el sistema sigue un flujo riguroso para garantizar la calidad y el cumplimiento.

## Estados de la Actividad

1. **PENDIENTE (Gris)**:
   - La actividad ha sido creada pero no se ha iniciado o no se han cargado evidencias.
   - *Acción*: El consultor debe cargar documentos o gestionar la tarea.

2. **EN REVISIÓN (Azul)**:
   - Se han cargado evidencias y la actividad está lista para auditoría.
   - *Acción*: El administrador o auditor revisa la calidad de la entrega.

3. **APROBADA (Verde)**:
   - La evidencia cumple con los requisitos normativos y de calidad.
   - La actividad se considera cerrada exitosamente.

4. **RECHAZADA (Rojo)**:
   - La evidencia tiene deficiencias o no cumple los requisitos.
   - **Importante**: Se debe revisar el "Motivo de Rechazo" (icono de mensaje en la columna de acciones) para corregir y volver a enviar.

## Prioridades

El sistema asigna prioridades automáticamente según la fecha de vencimiento:
- **Vencido (Rojo)**: La fecha límite ha pasado. Atención inmediata.
- **Por Vencer (Amarillo)**: Próximo a vencerse (7-30 días).
- **Cumplido (Verde)**: Completado a tiempo o con plazo lejano.

[Ver Video: Cómo gestionar una actividad rechazada](https://www.youtube.com/embed/placeholder)
    `
  },
  {
    id: "act-002",
    slug: "crear-actividad",
    title: "Creación y Asignación de Actividades",
    description: "Manual para generar nuevas obligaciones y tareas.",
    category: "Actividades",
    tags: ["crear", "asignar", "tareas"],
    roles: ['ADMIN_PMD', 'CONSULTANT'],
    updatedAt: "2026-02-20",
    icon: Activity,
    content: `
# Creación de Actividades

Las actividades pueden ser requisitos legales, tareas operativas o planes de acción.

## Pasos para Crear

1. Ingrese al detalle de una **Empresa**.
2. Vaya a la pestaña o sección de **Actividades**.
3. Haga clic en **"Nueva Actividad"**.
4. Defina:
   - **Título**: Claro y descriptivo (ej: "Capacitación Brigada de Emergencia").
   - **Fecha de Vencimiento**: Límite legal o interno.
   - **Prioridad**: Baja, Media, Alta (o automática).
   - **Asignado a**: (Opcional) Usuario específico responsable.

## Actividades Recurrentes

Para tareas que se repiten (ej: Inspecciones mensuales), se recomienda crear la actividad base y duplicarla o generar un cronograma.

*(Próximamente: Módulo de generación automática de cronogramas anuales)*
    `
  },

  // --- DOCUMENTOS ---
  {
    id: "doc-001",
    slug: "gestion-documental",
    title: "Carga y Versionamiento de Documentos",
    description: "Cómo subir evidencias y manejar versiones de archivos.",
    category: "Documentos",
    tags: ["archivos", "evidencias", "versiones"],
    roles: ['ADMIN_PMD', 'CONSULTANT'],
    updatedAt: "2026-01-10",
    icon: FolderOpen,
    content: `
# Gestión de Evidencias Documentales

El sistema PMD actúa como un repositorio seguro para toda la documentación SST.

## Carga de Archivos

1. Localice la actividad correspondiente.
2. Haga clic en el botón **"Subir Archivo"** o el icono de nube.
3. Seleccione el archivo desde su dispositivo (PDF, Excel, Word, Imágenes).
   - *Límite de tamaño*: 50MB por archivo.

## Versionamiento Automático

No necesita renombrar archivos como "final_v2_real.pdf".
- Si sube un archivo nuevo a una actividad que ya tiene uno, el sistema lo tratará como una **nueva versión**.
- Las versiones anteriores se conservan en el historial para auditoría, pero solo la más reciente es visible por defecto.

## Visualización Previa

Puede visualizar documentos PDF e imágenes directamente en el navegador sin necesidad de descargarlos, haciendo clic en el icono de "Ojo" (Ver).
    `
  },

  // --- USUARIOS ---
  {
    id: "usr-001",
    slug: "roles-permisos",
    title: "Matriz de Roles y Permisos",
    description: "Detalle de qué puede hacer cada tipo de usuario.",
    category: "Usuarios",
    tags: ["seguridad", "permisos", "accesos"],
    roles: ['ADMIN_PMD'],
    updatedAt: "2026-03-01",
    icon: ShieldCheck,
    content: `
# Niveles de Acceso

La seguridad de la información es prioritaria. El sistema utiliza un modelo de control de acceso basado en roles (RBAC).

| Funcionalidad | Administrador (ADMIN_PMD) | Consultor | Cliente (CLIENT_VIEWER) |
|---|---|---|---|
| **Ver Empresas** | Todas | Asignadas | Propia |
| **Crear Empresas** | ✅ Sí | ❌ No | ❌ No |
| **Editar Empresas** | ✅ Sí | ❌ No | ❌ No |
| **Ver Actividades** | Todas | Asignadas | Propia |
| **Crear/Editar Actividades** | ✅ Sí | ✅ Sí (Asignadas) | ❌ No |
| **Aprobar/Rechazar** | ✅ Sí | ❌ No | ❌ No |
| **Subir Documentos** | ✅ Sí | ✅ Sí | ❌ No |
| **Gestión de Usuarios** | ✅ Sí | ❌ No | ❌ No |
| **Configuración Global** | ✅ Sí | ❌ No | ❌ No |

## Crear Usuarios

Para dar acceso a un nuevo consultor o cliente:
1. Vaya a **Usuarios** > **Nuevo Usuario**.
2. Asigne el rol correcto.
3. El sistema enviará (simulado) las credenciales de acceso.
    `
  },
  {
    id: "usr-002",
    slug: "colaboradores",
    title: "Gestión de Colaboradores (Empleados)",
    description: "Administración de la base de datos de empleados por empresa.",
    category: "Usuarios",
    tags: ["empleados", "sst", "base de datos"],
    roles: ['ADMIN_PMD', 'CONSULTANT'],
    updatedAt: "2026-02-28",
    icon: Users,
    content: `
# Colaboradores de la Empresa

A diferencia de los "Usuarios" del sistema (que hacen login), los **Colaboradores** son los empleados de las empresas cliente a quienes se les gestiona la SST (exámenes médicos, EPPs, capacitación).

## Funcionalidades

- **Hoja de Vida**: Información sociodemográfica, contacto de emergencia.
- **Documentación**: Carga de certificados, aptitudes médicas, etc.
- **Estado**: Activo/Inactivo.

## Importación Masiva

*(Funcionalidad en Beta)*: Puede contactar a soporte para solicitar la carga masiva de colaboradores desde plantillas Excel.
    `
  },

  // --- CONFIGURACIÓN ---
  {
    id: "cfg-001",
    slug: "perfil-seguridad",
    title: "Mi Perfil y Seguridad",
    description: "Cambio de contraseña y actualización de datos.",
    category: "Configuración",
    tags: ["contraseña", "perfil", "datos"],
    roles: ['ADMIN_PMD', 'CONSULTANT', 'CLIENT_VIEWER'],
    updatedAt: "2025-12-01",
    icon: Settings,
    content: `
# Gestión de Cuenta Personal

Mantenga sus datos actualizados y seguros.

## Cambiar Contraseña

1. Haga clic en su avatar o iniciales en la esquina superior derecha.
2. Seleccione **Configuración** (o vaya al menú lateral).
3. En la sección "Seguridad", seleccione **Cambiar Contraseña**.
4. Ingrese su contraseña actual y la nueva (mínimo 8 caracteres).

## Actualizar Datos

Si su correo electrónico o teléfono cambia, por favor notifique a un administrador para que actualice su registro central, ya que el correo es su llave de acceso al sistema.
    `
  },
  
  // --- SOLUCIÓN DE PROBLEMAS ---
  {
    id: "trb-001",
    slug: "problemas-acceso",
    title: "Problemas Comunes de Acceso",
    description: "Qué hacer si no puede ingresar a la plataforma.",
    category: "General",
    tags: ["login", "error", "acceso"],
    roles: ['ADMIN_PMD', 'CONSULTANT', 'CLIENT_VIEWER'],
    updatedAt: "2026-01-15",
    icon: HelpCircle,
    content: `
# Resolución de Problemas de Ingreso

## "Credenciales Inválidas"

1. Verifique que no tenga activado el bloqueo de mayúsculas.
2. Asegúrese de estar usando el correo corporativo registrado.
3. Si olvidó su contraseña, contacte al administrador.

## La página no carga o se ve en blanco

1. Intente limpiar la caché de su navegador (Ctrl + F5).
2. Verifique su conexión a internet.
3. Pruebe ingresar desde una ventana de Incógnito.

Si el problema persiste, tome una captura de pantalla del error y envíela a soporte técnico.
    `
  }
];
