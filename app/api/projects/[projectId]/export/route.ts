import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/app/auth-actions";
import { NextResponse } from "next/server";
import archiver from "archiver";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PassThrough, Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import type { ReadableStream as StreamWebReadableStream } from "stream/web";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getEnvTrim(name: string): string | undefined {
  const v = process.env[name];
  const t = v?.trim();
  return t ? t : undefined;
}

function getBucketAndRegion() {
  const bucket = getEnvTrim("AWS_S3_BUCKET");
  const region = getEnvTrim("AWS_REGION");
  if (!bucket || !region) return null;
  return { bucket, region };
}

function getS3Client(region: string) {
  const accessKeyId = getEnvTrim("AWS_ACCESS_KEY_ID");
  const secretAccessKey = getEnvTrim("AWS_SECRET_ACCESS_KEY");
  return new S3Client({
    region: region || "us-east-1",
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  });
}

function sanitizeSegment(input: string) {
  const s = (input || "").trim();
  if (!s) return "sin-nombre";
  const cleaned = s
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 80) || "sin-nombre";
}

function sanitizeFileName(input: string) {
  const s = (input || "").trim();
  const cleaned = s
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "archivo").slice(0, 160);
}

function inferExtension(args: { url?: string | null; key?: string | null; name?: string | null }) {
  const from = (args.name || args.key || args.url || "").toString();
  const last = from.split("?")[0].split("#")[0];
  const dot = last.lastIndexOf(".");
  if (dot <= -1) return "";
  const ext = last.slice(dot);
  if (!/^\.[a-zA-Z0-9]{1,10}$/.test(ext)) return "";
  return ext.toLowerCase();
}

function ensureZipPathHasExtension(basePath: string, args: { url?: string | null; key?: string | null; name?: string | null }) {
  if (/\.[a-zA-Z0-9]{1,10}$/.test(basePath)) return basePath;
  const ext = inferExtension(args);
  return `${basePath}${ext || ".bin"}`;
}

function extractKeyFromS3Url(url: string) {
  try {
    const u = new URL(url);
    const key = decodeURIComponent(u.pathname.replace(/^\/+/, ""));
    return key || null;
  } catch {
    return null;
  }
}

async function getFileStream(args: { key?: string | null; url?: string | null }) {
  const keyFromUrl = args.url ? extractKeyFromS3Url(args.url) : null;
  const key = args.key || keyFromUrl;
  const bucketRegion = getBucketAndRegion();
  if (bucketRegion && key) {
    const s3 = getS3Client(bucketRegion.region);
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: bucketRegion.bucket,
        Key: key,
      })
    );
    const body = res.Body;
    if (!body) throw new Error("S3 body vacío");
    if (body instanceof Readable) return body;
    if (typeof (body as unknown as { transformToWebStream?: unknown }).transformToWebStream === "function") {
      const web = (body as unknown as { transformToWebStream: () => unknown }).transformToWebStream();
      return Readable.fromWeb(web as StreamWebReadableStream);
    }
    throw new Error("Respuesta S3 no soportada");
  }

  if (args.url) {
    const r = await fetch(args.url);
    if (!r.ok || !r.body) throw new Error(`No se pudo descargar (HTTP ${r.status})`);
    return Readable.fromWeb(r.body as unknown as StreamWebReadableStream);
  }

  throw new Error("Archivo sin url/key");
}

async function appendStreamAndWait(archive: archiver.Archiver, stream: Readable, name: string) {
  await new Promise<void>((resolve, reject) => {
    stream.once("error", reject);
    stream.once("end", () => resolve());
    archive.append(stream, { name });
  });
}

function ensureDir(archive: archiver.Archiver, path: string) {
  const name = path.endsWith("/") ? path : `${path}/`;
  archive.append("", { name });
}

function jsonReplacer(_key: string, value: unknown) {
  if (typeof value === "bigint") return value.toString();
  return value;
}

function toDateString(value: unknown) {
  if (!value) return "";
  const raw = value instanceof Date ? value.toISOString() : typeof value === "string" ? value : "";
  if (!raw) return "";
  const hasTime = raw.includes("T") || raw.includes(":");
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  const y = String(parsed.getFullYear());
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  if (!hasTime) return `${d}/${m}/${y}`;
  const hh = String(parsed.getHours()).padStart(2, "0");
  const mm = String(parsed.getMinutes()).padStart(2, "0");
  return `${d}/${m}/${y} ${hh}:${mm}`;
}

function toYesNo(value: unknown) {
  if (value === true) return "Sí";
  if (value === false) return "No";
  return "";
}

function toNumberString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  return value ? String(value) : "";
}

function sheetFromRows(rows: Record<string, unknown>[]) {
  return XLSX.utils.json_to_sheet(rows, { skipHeader: false });
}

type ExportUserRef = {
  name?: string | null;
  email?: string | null;
};

type ExportProject = {
  id: string;
  name: string;
  clientName: string;
  nit?: string | null;
  status: string;
  startDate: Date | string;
  description?: string | null;
  address?: string | null;
  department?: string | null;
  municipality?: string | null;
  phone?: string | null;
  workerCount?: number | null;
  ciiu?: string | null;
  economicActivity?: string | null;
  contractStartDate?: Date | string | null;
  contractNumber?: number | null;
  riskLevel?: string | null;
  chapter?: string | null;
  consultant?: ExportUserRef | null;
  clientUser?: ExportUserRef | null;
  logoUrl?: string | null;
};

type ExportCollaborator = {
  id: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  secondName?: string | null;
  firstSurname: string;
  secondSurname?: string | null;
  email: string;
  phone: string;
  position: string;
  startDate: Date | string;
  contractType: string;
  status: string;
};

type ExportBaseFile = {
  id: string;
  name: string;
  url: string;
  uploadedAt: Date | string;
  sizeBytes?: number | null;
  key?: string | null;
  kind?: string | null;
  version?: number | null;
};

type ExportActivity = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: Date | string | null;
  periodicity?: string | null;
  assignedTo?: ExportUserRef | null;
  documents?: ExportBaseFile[];
  inspectionEquipmentId?: string | null;
};

type ExportAccidentalidadFile = {
  id: string;
  name: string;
  url: string;
  uploadedAt: Date | string;
  version: number;
  sizeBytes?: number | null;
};

type ExportAccidentalidad = {
  id: string;
  actividad: string;
  status: string;
  priority: string;
  dueDate: Date | string;
  assignedTo?: ExportUserRef | null;
  archivos?: ExportAccidentalidadFile[];
};

type ExportSgsstFile = {
  id: string;
  name: string;
  url: string;
  key: string;
  uploadedAt: Date | string;
  version: number;
  sizeBytes?: number | null;
};

type ExportSgsstSection = {
  id: string;
  sortOrder: number;
  name: string;
  dueDate?: Date | string | null;
  dueStatus: string;
  periodicity?: string | null;
  files?: ExportSgsstFile[];
};

type ExportEquipmentPhoto = {
  id: string;
  name: string;
  url: string;
  key: string;
  uploadedAt: Date | string;
  sizeBytes?: number | null;
};

type ExportEquipment = {
  id: string;
  name: string;
  code?: string | null;
  location?: string | null;
  brand?: string | null;
  model?: string | null;
  serial?: string | null;
  teamResponsible?: string | null;
  teamUser?: string | null;
  verificationPeriodicity?: string | null;
  maintenancePeriodicity?: string | null;
  observations?: string | null;
  photos?: ExportEquipmentPhoto[];
};

type ExportVehicleDocument = {
  id: string;
  kind: string;
  name: string;
  url: string;
  key: string;
  uploadedAt: Date | string;
  sizeBytes?: number | null;
};

type ExportVehicle = {
  id: string;
  verificationDate: Date | string;
  plate: string;
  vin?: string | null;
  engineNumber?: string | null;
  model?: string | null;
  brand?: string | null;
  line?: string | null;
  color?: string | null;
  mileage?: string | null;
  ownerName?: string | null;
  ownerId?: string | null;
  soatDueDate?: Date | string | null;
  rtmDueDate?: Date | string | null;
  documents?: ExportVehicleDocument[];
};

type ExportDriverDocument = {
  id: string;
  kind: string;
  name: string;
  url: string;
  key: string;
  uploadedAt: Date | string;
  sizeBytes?: number | null;
};

type ExportDriver = {
  id: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  position?: string | null;
  licenseCategory?: string | null;
  licenseDueDate?: Date | string | null;
  licenseStatus?: string | null;
  roadSafetyTraining?: boolean | null;
  evaluationDueDate?: Date | string | null;
  vehiclePlate?: string | null;
  missionTripsPlanner?: string | null;
  documents?: ExportDriverDocument[];
};

type ExportIndicatorMeasurement = {
  periodStart: Date | string;
  periodEnd: Date | string;
  computedValue: number;
  compliancePct: number;
  resultAnalysis?: string | null;
};

type ExportIndicator = {
  id: string;
  name: string;
  type?: string | null;
  unit: string;
  periodicity: string;
  targetPercent: number;
  formula: string;
  measurements?: ExportIndicatorMeasurement[];
};

type ExportCustomSectionDoc = {
  id: string;
  name: string;
  url: string;
  key: string;
  uploadedAt: Date | string;
  version: number;
  sizeBytes?: number | null;
};

type ExportCustomSectionActivity = {
  id: string;
  name: string;
  dueDate?: Date | string | null;
  documents?: ExportCustomSectionDoc[];
};

type ExportCustomSection = {
  id: string;
  name: string;
  enabled: boolean;
  activities?: ExportCustomSectionActivity[];
};

type ExportLearningCourse = {
  id: string;
  title: string;
  description?: string | null;
  certificateEnabled: boolean;
  coverUrl?: string | null;
  modules?: unknown[];
  exam?: unknown | null;
};

function makeWorkbook(args: {
  project: ExportProject;
  collaborators: ExportCollaborator[];
  accidentalidad: ExportAccidentalidad[];
  sgsstSections: ExportSgsstSection[];
  equipments: ExportEquipment[];
  vehicles: ExportVehicle[];
  drivers: ExportDriver[];
  indicators: ExportIndicator[];
  customSections: ExportCustomSection[];
  learningCourses: ExportLearningCourse[];
  requirementsActivities: ExportActivity[];
  maintenanceActivities: ExportActivity[];
  files: ExportFile[];
  warnings: ExportWarning[];
}) {
  const wb = XLSX.utils.book_new();

  const empresaRows: Record<string, unknown>[] = [
    {
      ID: args.project.id,
      Empresa: args.project.name,
      Cliente: args.project.clientName,
      NIT: args.project.nit ?? "",
      Estado: args.project.status,
      "Fecha inicio": toDateString(args.project.startDate),
      Descripción: args.project.description ?? "",
      Dirección: args.project.address ?? "",
      Departamento: args.project.department ?? "",
      Municipio: args.project.municipality ?? "",
      Teléfono: args.project.phone ?? "",
      Trabajadores: args.project.workerCount ?? "",
      CIIU: args.project.ciiu ?? "",
      "Actividad económica": args.project.economicActivity ?? "",
      "Inicio contrato": toDateString(args.project.contractStartDate),
      "Nº contrato": args.project.contractNumber ?? "",
      "Nivel de riesgo": args.project.riskLevel ?? "",
      Capítulo: args.project.chapter ?? "",
      Consultor: args.project.consultant?.name ?? "",
      "Email consultor": args.project.consultant?.email ?? "",
      "Usuario cliente": args.project.clientUser?.name ?? "",
      "Email cliente": args.project.clientUser?.email ?? "",
    },
  ];
  XLSX.utils.book_append_sheet(wb, sheetFromRows(empresaRows), "Empresa");

  const collaboratorsRows = args.collaborators.map((c) => ({
    ID: c.id,
    "Tipo doc": c.documentType,
    "Nº doc": c.documentNumber,
    Nombres: [c.firstName, c.secondName].filter(Boolean).join(" "),
    Apellidos: [c.firstSurname, c.secondSurname].filter(Boolean).join(" "),
    Email: c.email,
    Teléfono: c.phone,
    Cargo: c.position,
    "Fecha ingreso": toDateString(c.startDate),
    "Tipo contrato": c.contractType,
    Estado: c.status,
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(collaboratorsRows), "Colaboradores");

  const reqRows = args.requirementsActivities.map((a) => ({
    ID: a.id,
    Requisito: a.title,
    Estado: a.status,
    Prioridad: a.priority,
    Vence: toDateString(a.dueDate),
    Periodicidad: a.periodicity ?? "",
    "Asignado a": a.assignedTo?.name ?? "",
    Documentos: a.documents?.length ?? 0,
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(reqRows), "Requisitos");

  const reqDocsRows = args.requirementsActivities.flatMap((a) =>
    (a.documents || []).map((d) => ({
      "Requisito ID": a.id,
      Requisito: a.title,
      "Documento ID": d.id,
      Documento: d.name,
      Versión: d.version,
      Fecha: toDateString(d.uploadedAt),
      URL: d.url,
      "Tamaño (bytes)": toNumberString(d.sizeBytes),
    }))
  );
  XLSX.utils.book_append_sheet(wb, sheetFromRows(reqDocsRows), "Docs Requisitos");

  const accRows = args.accidentalidad.map((x) => ({
    ID: x.id,
    Actividad: x.actividad,
    Estado: x.status,
    Prioridad: x.priority,
    Vence: toDateString(x.dueDate),
    "Asignado a": x.assignedTo?.name ?? "",
    Archivos: x.archivos?.length ?? 0,
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(accRows), "Accidentalidad");

  const accFilesRows = args.accidentalidad.flatMap((x) =>
    (x.archivos || []).map((f) => ({
      "Accidentalidad ID": x.id,
      Actividad: x.actividad,
      "Archivo ID": f.id,
      Archivo: f.name,
      Versión: f.version,
      Fecha: toDateString(f.uploadedAt),
      URL: f.url,
      "Tamaño (bytes)": toNumberString(f.sizeBytes),
    }))
  );
  XLSX.utils.book_append_sheet(wb, sheetFromRows(accFilesRows), "Docs Accidentalidad");

  const sgsstRows = args.sgsstSections.map((s) => ({
    ID: s.id,
    Orden: s.sortOrder,
    Sección: s.name,
    Vencimiento: toDateString(s.dueDate),
    "Estado vencimiento": s.dueStatus,
    Periodicidad: s.periodicity ?? "",
    Archivos: s.files?.length ?? 0,
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(sgsstRows), "SGSST");

  const sgsstFilesRows = args.sgsstSections.flatMap((s) =>
    (s.files || []).map((f) => ({
      "Sección ID": s.id,
      Sección: s.name,
      "Archivo ID": f.id,
      Archivo: f.name,
      Versión: f.version,
      Fecha: toDateString(f.uploadedAt),
      URL: f.url,
      "Key (técnico)": f.key,
      "Tamaño (bytes)": toNumberString(f.sizeBytes),
    }))
  );
  XLSX.utils.book_append_sheet(wb, sheetFromRows(sgsstFilesRows), "Docs SGSST");

  const equipRows = args.equipments.map((e) => ({
    ID: e.id,
    Equipo: e.name,
    Código: e.code ?? "",
    Ubicación: e.location ?? "",
    Marca: e.brand ?? "",
    Modelo: e.model ?? "",
    Serial: e.serial ?? "",
    Responsable: e.teamResponsible ?? "",
    Usuario: e.teamUser ?? "",
    "Periodicidad verificación": e.verificationPeriodicity ?? "",
    "Periodicidad mantenimiento": e.maintenancePeriodicity ?? "",
    Observaciones: e.observations ?? "",
    Fotos: e.photos?.length ?? 0,
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(equipRows), "Equipos");

  const equipPhotosRows = args.equipments.flatMap((e) =>
    (e.photos || []).map((p) => ({
      "Equipo ID": e.id,
      Equipo: e.name,
      "Foto ID": p.id,
      Foto: p.name,
      Fecha: toDateString(p.uploadedAt),
      URL: p.url,
      "Key (técnico)": p.key,
      "Tamaño (bytes)": toNumberString(p.sizeBytes),
    }))
  );
  XLSX.utils.book_append_sheet(wb, sheetFromRows(equipPhotosRows), "Fotos Equipos");

  const maintenanceRows = args.maintenanceActivities.map((a) => ({
    ID: a.id,
    "Equipo ID": a.inspectionEquipmentId ?? "",
    Equipo: a.inspectionEquipmentId ? args.equipments.find((e) => e.id === a.inspectionEquipmentId)?.name ?? "" : "",
    Actividad: a.title,
    Estado: a.status,
    Prioridad: a.priority,
    Vence: toDateString(a.dueDate),
    Documentos: a.documents?.length ?? 0,
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(maintenanceRows), "Activ. Mant.");

  const vehiclesRows = args.vehicles.map((v) => ({
    ID: v.id,
    Placa: v.plate,
    "Fecha verificación": toDateString(v.verificationDate),
    VIN: v.vin ?? "",
    Motor: v.engineNumber ?? "",
    Modelo: v.model ?? "",
    Marca: v.brand ?? "",
    Línea: v.line ?? "",
    Color: v.color ?? "",
    Kilometraje: v.mileage ?? "",
    Propietario: v.ownerName ?? "",
    "Propietario ID": v.ownerId ?? "",
    "Vence SOAT": toDateString(v.soatDueDate),
    "Vence RTM": toDateString(v.rtmDueDate),
    Documentos: v.documents?.length ?? 0,
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(vehiclesRows), "Vehículos");

  const vehiclesDocsRows = args.vehicles.flatMap((v) =>
    (v.documents || []).map((d) => ({
      "Vehículo ID": v.id,
      Placa: v.plate,
      "Documento ID": d.id,
      Tipo: d.kind,
      Documento: d.name,
      Fecha: toDateString(d.uploadedAt),
      URL: d.url,
      "Key (técnico)": d.key,
      "Tamaño (bytes)": toNumberString(d.sizeBytes),
    }))
  );
  XLSX.utils.book_append_sheet(wb, sheetFromRows(vehiclesDocsRows), "Docs Vehículos");

  const driversRows = args.drivers.map((d) => ({
    ID: d.id,
    Conductor: d.fullName,
    "Tipo doc": d.documentType,
    "Nº doc": d.documentNumber,
    Cargo: d.position ?? "",
    "Categoría licencia": d.licenseCategory ?? "",
    "Vence licencia": toDateString(d.licenseDueDate),
    "Estado licencia": d.licenseStatus ?? "",
    Capacitación: toYesNo(d.roadSafetyTraining),
    "Vence evaluación": toDateString(d.evaluationDueDate),
    "Placa vehículo": d.vehiclePlate ?? "",
    "Plan viajes": d.missionTripsPlanner ?? "",
    Documentos: d.documents?.length ?? 0,
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(driversRows), "Conductores");

  const driversDocsRows = args.drivers.flatMap((d) =>
    (d.documents || []).map((doc) => ({
      "Conductor ID": d.id,
      Conductor: d.fullName,
      "Documento ID": doc.id,
      Tipo: doc.kind,
      Documento: doc.name,
      Fecha: toDateString(doc.uploadedAt),
      URL: doc.url,
      "Key (técnico)": doc.key,
      "Tamaño (bytes)": toNumberString(doc.sizeBytes),
    }))
  );
  XLSX.utils.book_append_sheet(wb, sheetFromRows(driversDocsRows), "Docs Conductores");

  const indicatorRows = args.indicators.map((i) => ({
    ID: i.id,
    Indicador: i.name,
    Tipo: i.type ?? "",
    Unidad: i.unit,
    Periodicidad: i.periodicity,
    "Meta (%)": i.targetPercent,
    Fórmula: i.formula,
    Mediciones: i.measurements?.length ?? 0,
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(indicatorRows), "Indicadores");

  const measurementsRows = args.indicators.flatMap((i) =>
    (i.measurements || []).map((m) => ({
      "Indicador ID": i.id,
      Indicador: i.name,
      "Periodo inicio": toDateString(m.periodStart),
      "Periodo fin": toDateString(m.periodEnd),
      Valor: m.computedValue,
      "Cumplimiento (%)": m.compliancePct,
      Análisis: m.resultAnalysis ?? "",
    }))
  );
  XLSX.utils.book_append_sheet(wb, sheetFromRows(measurementsRows), "Mediciones");

  const customSectionsRows = args.customSections.map((s) => ({
    ID: s.id,
    Sección: s.name,
    Habilitada: toYesNo(s.enabled),
    Actividades: s.activities?.length ?? 0,
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(customSectionsRows), "Secc. Personal.");

  const customActivitiesRows = args.customSections.flatMap((s) =>
    (s.activities || []).map((a) => ({
      "Sección ID": s.id,
      Sección: s.name,
      "Actividad ID": a.id,
      Actividad: a.name,
      Vence: toDateString(a.dueDate),
      Documentos: a.documents?.length ?? 0,
    }))
  );
  XLSX.utils.book_append_sheet(wb, sheetFromRows(customActivitiesRows), "Act. Personal.");

  const customDocsRows = args.customSections.flatMap((s) =>
    (s.activities || []).flatMap((a) =>
      (a.documents || []).map((d) => ({
        Sección: s.name,
        Actividad: a.name,
        "Documento ID": d.id,
        Documento: d.name,
        Versión: d.version,
        Fecha: toDateString(d.uploadedAt),
        URL: d.url,
        "Key (técnico)": d.key,
        "Tamaño (bytes)": toNumberString(d.sizeBytes),
      }))
    )
  );
  XLSX.utils.book_append_sheet(wb, sheetFromRows(customDocsRows), "Docs Personal.");

  const learningRows = args.learningCourses.map((c) => ({
    ID: c.id,
    Curso: c.title,
    Descripción: c.description ?? "",
    Módulos: c.modules?.length ?? 0,
    Examen: toYesNo(!!c.exam),
    Certificado: toYesNo(c.certificateEnabled),
    Carátula: c.coverUrl ? "Sí" : "",
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(learningRows), "Formación");

  const filesRows = args.files.map((f) => ({
    Origen: f.source,
    "Ruta en ZIP": f.zipPath,
    URL: f.url ?? "",
    "Key (técnico)": f.key ?? "",
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(filesRows), "Archivos");

  const warningsRows = args.warnings.map((w) => ({
    Área: w.area,
    "Código Prisma": w.prismaCode ?? "",
    Detalle: w.message,
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(warningsRows), "Warnings");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

type ExportFile = {
  zipPath: string;
  key?: string | null;
  url?: string | null;
  source: string;
};

type ExportWarning = {
  area: string;
  prismaCode: string | null;
  message: string;
};

function getPrismaErrorCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  if (user.role !== "ADMIN_PMD") return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  const { projectId } = await ctx.params;
  const warnings: ExportWarning[] = [];

  const safeQuery = async <T,>(area: string, fn: () => Promise<T>, fallback: T) => {
    try {
      return await fn();
    } catch (error) {
      const code = getPrismaErrorCode(error);
      const message = error instanceof Error ? error.message : "Error desconocido";
      warnings.push({ area, prismaCode: code, message });
      return fallback;
    }
  };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      clientName: true,
      description: true,
      startDate: true,
      status: true,
      nit: true,
      address: true,
      department: true,
      municipality: true,
      phone: true,
      workerCount: true,
      ciiu: true,
      economicActivity: true,
      contractStartDate: true,
      contractNumber: true,
      riskLevel: true,
      chapter: true,
      logoUrl: true,
      consultant: { select: { id: true, name: true, email: true, role: true } },
      clientUser: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  if (!project) return NextResponse.json({ success: false, error: "Empresa no encontrada" }, { status: 404 });

  const collaborators = await safeQuery("collaborators", async () => {
    return prisma.collaborator.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
  }, []);

  const activities = await safeQuery("requirements.activities", async () => {
    return prisma.activity.findMany({
      where: { projectId, collaboratorId: null },
      orderBy: [{ inspectionEquipmentId: "asc" }, { title: "asc" }],
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        documents: { where: { deletedAt: null }, orderBy: { uploadedAt: "asc" } },
        collaborator: {
          select: {
            id: true,
            documentType: true,
            documentNumber: true,
            firstName: true,
            secondName: true,
            firstSurname: true,
            secondSurname: true,
            email: true,
            phone: true,
            position: true,
            status: true,
          },
        },
      },
    });
  }, []);

  const accidentalidad = await safeQuery("accidentalidad", async () => {
    return prisma.accidentalidadEmpresa.findMany({
      where: { projectId },
      orderBy: { dueDate: "asc" },
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        archivos: { where: { deletedAt: null }, orderBy: { uploadedAt: "asc" } },
        historial: { orderBy: { changedAt: "asc" } },
      },
    });
  }, []);

  const sgsstSections = await safeQuery("sgsst-design", async () => {
    return prisma.sgSstDesignSection.findMany({
      where: { projectId },
      orderBy: { sortOrder: "asc" },
      include: { files: { where: { deletedAt: null }, orderBy: { uploadedAt: "asc" } } },
    });
  }, []);

  const equipments = await safeQuery("inspection-maintenance.equipments", async () => {
    return prisma.inspectionEquipment.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: { photos: { where: { deletedAt: null }, orderBy: { uploadedAt: "asc" } } },
    });
  }, []);

  const vehicles = await safeQuery("vehicles-inspection", async () => {
    return prisma.vehicleInspectionVehicle.findMany({
      where: { projectId },
      orderBy: { verificationDate: "desc" },
      include: { documents: { where: { deletedAt: null }, orderBy: { uploadedAt: "asc" } } },
    });
  }, []);

  const drivers = await safeQuery("drivers-inspection", async () => {
    return prisma.driverInspectionDriver.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: { documents: { where: { deletedAt: null }, orderBy: { uploadedAt: "asc" } } },
    });
  }, []);

  const indicators = await safeQuery("minimum-indicators", async () => {
    return prisma.minimumIndicator.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        measurements: { where: { deletedAt: null }, orderBy: { periodStart: "asc" } },
      },
    });
  }, []);

  const projectSections = await safeQuery("project.sections", async () => {
    return prisma.projectSection.findMany({
      where: { projectId },
      orderBy: { sectionKey: "asc" },
    });
  }, []);

  const customSections = await safeQuery("custom-sections", async () => {
    return prisma.customProjectSection.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: {
        activities: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: { documents: { where: { deletedAt: null }, orderBy: { uploadedAt: "asc" } } },
        },
      },
    });
  }, []);

  const learningCourses = await safeQuery("learning", async () => {
    return prisma.learningCourse.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        modules: {
          orderBy: { order: "asc" },
        },
        exam: true,
      },
    });
  }, []);

  const rootName = sanitizeSegment(`${project.name}${project.nit ? ` - NIT ${project.nit}` : ""}`);
  const zipFileName = sanitizeFileName(`${rootName}.zip`);
  const rootFolder = sanitizeSegment(rootName);

  const files: ExportFile[] = [];
  const equipmentById = new Map(equipments.map((e) => [e.id, e]));
  const requirementsActivities = activities.filter((a) => !a.inspectionEquipmentId);
  const maintenanceActivities = activities.filter((a) => !!a.inspectionEquipmentId);

  if (project.logoUrl) {
    files.push({
      source: "project.logoUrl",
      url: project.logoUrl,
      zipPath: `${rootFolder}/00_Empresa/Logo/${sanitizeFileName("logo")}`,
    });
  }

  for (const a of requirementsActivities) {
    const activityFolder = `${rootFolder}/01_Requisitos/${sanitizeSegment(`${a.title} (${a.id.slice(0, 8)})`)}`;
    for (const d of a.documents) {
      files.push({
        source: "activity.document",
        url: d.url,
        zipPath: `${activityFolder}/Documentos/${sanitizeFileName(`${String(d.version).padStart(2, "0")}-${d.name} (${d.id.slice(0, 8)})`)}`,
      });
    }
  }

  for (const a of maintenanceActivities) {
    const equipmentName = a.inspectionEquipmentId ? equipmentById.get(a.inspectionEquipmentId)?.name : null;
    const equipFolder = `${rootFolder}/05_Inspecciones_y_Mantenimiento/Actividades/${sanitizeSegment(
      `${equipmentName || "Equipo"} (${(a.inspectionEquipmentId || "").slice(0, 8) || "sin-id"})`
    )}`;
    const activityFolder = `${equipFolder}/${sanitizeSegment(`${a.title} (${a.id.slice(0, 8)})`)}`;
    for (const d of a.documents) {
      files.push({
        source: "inspectionMaintenance.activity.document",
        url: d.url,
        zipPath: `${activityFolder}/Documentos/${sanitizeFileName(`${String(d.version).padStart(2, "0")}-${d.name} (${d.id.slice(0, 8)})`)}`,
      });
    }
  }

  for (const acc of accidentalidad) {
    const accFolder = `${rootFolder}/02_Accidentalidad/${sanitizeSegment(`${acc.actividad} (${acc.id.slice(0, 8)})`)}`;
    for (const f of acc.archivos) {
      files.push({
        source: "accidentalidad.archivo",
        url: f.url,
        zipPath: `${accFolder}/Archivos/${sanitizeFileName(`${String(f.version).padStart(2, "0")}-${f.name} (${f.id.slice(0, 8)})`)}`,
      });
    }
  }

  for (const s of sgsstSections) {
    const sFolder = `${rootFolder}/04_Diseño_SG-SST/${sanitizeSegment(`${s.sortOrder.toString().padStart(2, "0")} - ${s.name}`)}`;
    for (const f of s.files) {
      files.push({
        source: "sgsst.file",
        url: f.url,
        key: f.key,
        zipPath: `${sFolder}/Archivos/${sanitizeFileName(f.name)}`,
      });
    }
  }

  for (const e of equipments) {
    const eFolder = `${rootFolder}/05_Inspecciones_y_Mantenimiento/${sanitizeSegment(`${e.name} (${e.id.slice(0, 8)})`)}`;
    for (const p of e.photos) {
      files.push({
        source: "inspectionEquipment.photo",
        url: p.url,
        key: p.key,
        zipPath: `${eFolder}/Fotos/${sanitizeFileName(p.name)}`,
      });
    }
  }

  for (const v of vehicles) {
    const vFolder = `${rootFolder}/06_Listado_Vehiculos/${sanitizeSegment(`${v.plate} (${v.id.slice(0, 8)})`)}`;
    for (const d of v.documents) {
      files.push({
        source: "vehicle.document",
        url: d.url,
        key: d.key,
        zipPath: `${vFolder}/Documentos/${sanitizeFileName(d.name)}`,
      });
    }
  }

  for (const d of drivers) {
    const dFolder = `${rootFolder}/07_Listado_Conductores/${sanitizeSegment(`${d.fullName} (${d.id.slice(0, 8)})`)}`;
    for (const doc of d.documents) {
      files.push({
        source: "driver.document",
        url: doc.url,
        key: doc.key,
        zipPath: `${dFolder}/Documentos/${sanitizeFileName(doc.name)}`,
      });
    }
  }

  for (const s of customSections) {
    const sFolder = `${rootFolder}/09_Secciones_Personalizadas/${sanitizeSegment(`${s.name} (${s.id.slice(0, 8)})`)}`;
    for (const a of s.activities) {
      const aFolder = `${sFolder}/${sanitizeSegment(`${a.name} (${a.id.slice(0, 8)})`)}`;
      for (const doc of a.documents) {
        files.push({
          source: "customSection.document",
          url: doc.url,
          key: doc.key,
          zipPath: `${aFolder}/Documentos/${sanitizeFileName(doc.name)}`,
        });
      }
    }
  }

  for (const c of learningCourses) {
    const cFolder = `${rootFolder}/10_Formación_Empresarial/${sanitizeSegment(`${c.title} (${c.id.slice(0, 8)})`)}`;
    if (c.coverUrl || c.coverKey) {
      files.push({
        source: "learning.cover",
        url: c.coverUrl ?? null,
        key: c.coverKey ?? null,
        zipPath: `${cFolder}/Caratula/${sanitizeFileName("caratula")}`,
      });
    }
  }

  const archive = archiver("zip", { zlib: { level: 9 } });
  const pass = new PassThrough();
  archive.pipe(pass);

  const startedAt = new Date().toISOString();
  const exportId = randomUUID();
  const manifest = {
    exportId,
    startedAt,
    projectId,
    rootFolder,
    filesCount: files.length,
    files,
    warnings,
  };

  ensureDir(archive, `${rootFolder}/00_Empresa`);
  ensureDir(archive, `${rootFolder}/01_Requisitos`);
  ensureDir(archive, `${rootFolder}/02_Accidentalidad`);
  ensureDir(archive, `${rootFolder}/03_Colaboradores`);
  ensureDir(archive, `${rootFolder}/04_Diseño_SG-SST`);
  ensureDir(archive, `${rootFolder}/05_Inspecciones_y_Mantenimiento`);
  ensureDir(archive, `${rootFolder}/06_Listado_Vehiculos`);
  ensureDir(archive, `${rootFolder}/07_Listado_Conductores`);
  ensureDir(archive, `${rootFolder}/08_Indicadores_Minimos`);
  ensureDir(archive, `${rootFolder}/09_Secciones_Personalizadas`);
  ensureDir(archive, `${rootFolder}/10_Formación_Empresarial`);
  ensureDir(archive, `${rootFolder}/99_Meta`);
  ensureDir(archive, `${rootFolder}/99_Meta/errores`);
  ensureDir(archive, `${rootFolder}/99_Meta/data`);

  const reportXlsx = makeWorkbook({
    project,
    collaborators,
    accidentalidad,
    sgsstSections,
    equipments,
    vehicles,
    drivers,
    indicators,
    customSections,
    learningCourses,
    requirementsActivities,
    maintenanceActivities,
    files,
    warnings,
  });
  archive.append(reportXlsx, { name: `${rootFolder}/00_Empresa/Resumen.xlsx` });

  archive.append(JSON.stringify({ project }, jsonReplacer, 2), { name: `${rootFolder}/99_Meta/data/empresa.json` });
  archive.append(JSON.stringify({ projectSections }, jsonReplacer, 2), {
    name: `${rootFolder}/99_Meta/data/secciones.json`,
  });
  archive.append(JSON.stringify({ collaborators }, jsonReplacer, 2), {
    name: `${rootFolder}/99_Meta/data/colaboradores.json`,
  });
  archive.append(JSON.stringify({ activities: requirementsActivities }, jsonReplacer, 2), {
    name: `${rootFolder}/99_Meta/data/requisitos.json`,
  });
  archive.append(JSON.stringify({ accidentalidad }, jsonReplacer, 2), {
    name: `${rootFolder}/99_Meta/data/accidentalidad.json`,
  });
  archive.append(JSON.stringify({ sgsstSections }, jsonReplacer, 2), {
    name: `${rootFolder}/99_Meta/data/sgsst.json`,
  });
  archive.append(JSON.stringify({ equipments }, jsonReplacer, 2), {
    name: `${rootFolder}/99_Meta/data/equipos.json`,
  });
  archive.append(JSON.stringify({ activities: maintenanceActivities }, jsonReplacer, 2), {
    name: `${rootFolder}/99_Meta/data/actividades_mantenimiento.json`,
  });
  archive.append(JSON.stringify({ vehicles }, jsonReplacer, 2), {
    name: `${rootFolder}/99_Meta/data/vehiculos.json`,
  });
  archive.append(JSON.stringify({ drivers }, jsonReplacer, 2), {
    name: `${rootFolder}/99_Meta/data/conductores.json`,
  });
  archive.append(JSON.stringify({ indicators }, jsonReplacer, 2), {
    name: `${rootFolder}/99_Meta/data/indicadores.json`,
  });
  archive.append(JSON.stringify({ customSections }, jsonReplacer, 2), {
    name: `${rootFolder}/99_Meta/data/secciones_personalizadas.json`,
  });
  archive.append(JSON.stringify({ learningCourses }, jsonReplacer, 2), {
    name: `${rootFolder}/99_Meta/data/formacion.json`,
  });
  archive.append(JSON.stringify(manifest, jsonReplacer, 2), {
    name: `${rootFolder}/99_Meta/manifest.json`,
  });
  if (warnings.length > 0) {
    archive.append(JSON.stringify({ warnings }, jsonReplacer, 2), {
      name: `${rootFolder}/99_Meta/warnings.json`,
    });
  }

  (async () => {
    const usedPaths = new Set<string>();
    for (const f of files) {
      let zipPath = ensureZipPathHasExtension(f.zipPath, { url: f.url, key: f.key });
      if (usedPaths.has(zipPath)) {
        zipPath = ensureZipPathHasExtension(`${f.zipPath}-${randomUUID().slice(0, 8)}`, { url: f.url, key: f.key });
      }
      usedPaths.add(zipPath);
      try {
        const stream = await getFileStream({ key: f.key, url: f.url });
        await appendStreamAndWait(archive, stream, zipPath);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        const errName = sanitizeFileName(`${f.source}-${randomUUID().slice(0, 8)}.txt`);
        archive.append(JSON.stringify({ file: f, error: message }, jsonReplacer, 2), {
          name: `${rootFolder}/99_Meta/errores/${errName}`,
        });
      }
    }
    await archive.finalize();
  })().catch(async (e) => {
    const message = e instanceof Error ? e.message : "Error desconocido";
    archive.append(JSON.stringify({ error: message }, jsonReplacer, 2), {
      name: `${rootFolder}/99_Meta/fatal-${randomUUID().slice(0, 8)}.json`,
    });
    await archive.finalize();
  });

  const stream = Readable.toWeb(pass) as unknown as ReadableStream<Uint8Array>;
  return new Response(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipFileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
