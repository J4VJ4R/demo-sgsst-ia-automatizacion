"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { sendAgendaMeetingReport } from "@/app/actions";

type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  startIso: string;
  endIso?: string | null;
  htmlLink?: string | null;
};

type MeetingReportItem = {
  id: string;
  meetingDate: string;
  activities: string;
  tasks: Array<{ id: string; text: string }>;
  observations: Array<{ id: string; text: string }>;
  recipients: string[];
  createdAt: number;
  sentAt?: number | null;
};

function reportSignature(r: MeetingReportItem) {
  const tasks = (r.tasks || []).map((t) => (t?.text || "").trim()).filter(Boolean).join("\n");
  const observations = (r.observations || []).map((o) => (o?.text || "").trim()).filter(Boolean).join("\n");
  const recipients = (r.recipients || []).map((e) => (e || "").trim().toLowerCase()).filter(Boolean).sort().join(",");
  const activities = (r.activities || "").trim();
  const meetingDate = (r.meetingDate || "").trim();
  return `${meetingDate}||${activities}||${tasks}||${observations}||${recipients}`;
}

function dedupeReportList(list: Array<MeetingReportItem>) {
  const out: Array<MeetingReportItem> = [];
  const seenById = new Set<string>();
  const bestBySig = new Map<string, MeetingReportItem>();

  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    if (!r.id) continue;
    if (seenById.has(r.id)) continue;
    seenById.add(r.id);
    const sig = reportSignature(r);
    const prev = bestBySig.get(sig);
    if (!prev) {
      bestBySig.set(sig, r);
      continue;
    }
    const prevSent = typeof prev.sentAt === "number" ? prev.sentAt : null;
    const nextSent = typeof r.sentAt === "number" ? r.sentAt : null;
    if (!prevSent && nextSent) {
      bestBySig.set(sig, r);
      continue;
    }
    if (prevSent && nextSent) {
      if (nextSent > prevSent) bestBySig.set(sig, r);
      continue;
    }
    if (!prevSent && !nextSent) {
      if (r.createdAt > prev.createdAt) bestBySig.set(sig, r);
    }
  }

  for (const r of bestBySig.values()) out.push(r);
  out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return out;
}

function dedupeReportsMap(input: Record<string, Array<MeetingReportItem>>) {
  const out: Record<string, Array<MeetingReportItem>> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = Array.isArray(v) ? dedupeReportList(v) : [];
  }
  return out;
}

type EventsResponse =
  | {
      connected: true;
      email: string;
      timeZone: string;
      start: string;
      end: string;
      days: Array<{ date: string; events: CalendarEvent[] }>;
    }
  | { connected: false; error?: string };

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function toBogotaLabel(d: Date) {
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function weekdayLabel(d: Date) {
  const names = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return names[d.getDay()] || "";
}

export function ProjectAgenda(props: { projectId: string }) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(new Date()));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<EventsResponse | null>(null);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSending, setReportSending] = useState(false);
  const [reportMode, setReportMode] = useState<"create" | "edit" | "view">("create");
  const [reportEvent, setReportEvent] = useState<{
    dateKey: string;
    dateLabel: string;
    event: CalendarEvent;
  } | null>(null);
  const [reportRef, setReportRef] = useState<{
    key: string;
    id: string | null;
    createdAt: number | null;
    sentAt: number | null;
  } | null>(null);

  const [reportMeetingDate, setReportMeetingDate] = useState("");
  const [reportActivities, setReportActivities] = useState("");
  const [taskDraft, setTaskDraft] = useState("");
  const [tasks, setTasks] = useState<Array<{ id: string; text: string }>>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState("");
  const [observationDraft, setObservationDraft] = useState("");
  const [observations, setObservations] = useState<Array<{ id: string; text: string }>>([]);
  const [editingObservationId, setEditingObservationId] = useState<string | null>(null);
  const [editingObservationText, setEditingObservationText] = useState("");
  const [recipientDraft, setRecipientDraft] = useState("");
  const [recipients, setRecipients] = useState<Array<{ id: string; email: string }>>([]);

  const [savedReports, setSavedReports] = useState<
    Record<
      string,
      Array<MeetingReportItem>
    >
  >({});

  const reportsStorageKey = useMemo(() => `pmd:gcal:reports:${props.projectId}`, [props.projectId]);

  const startKey = useMemo(() => formatDateKey(weekStart), [weekStart]);

  const returnTo = useMemo(() => `/projects/${props.projectId}?view=agenda`, [props.projectId]);
  const connectUrl = useMemo(() => `/api/google-calendar/auth?returnTo=${encodeURIComponent(returnTo)}`, [returnTo]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(reportsStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return;
      setSavedReports(dedupeReportsMap(parsed as Record<string, Array<MeetingReportItem>>));
    } catch {
    }
  }, [reportsStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(reportsStorageKey, JSON.stringify(savedReports));
    } catch {
    }
  }, [reportsStorageKey, savedReports]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gcal = (params.get("gcal") || "").trim();
    const reason = (params.get("reason") || "").trim();

    const message =
      gcal === "connected"
        ? "Cuenta conectada correctamente."
        : gcal === "cancelled"
          ? "Conexión cancelada."
          : gcal === "missing_code"
            ? "No se recibió el código de autorización de Google."
            : gcal === "missing_refresh"
              ? "Google no devolvió el refresh token. Intenta conectar de nuevo."
              : gcal === "error_state"
                ? "Conexión inválida (state). Intenta conectar de nuevo."
                : gcal === "misconfigured" && reason === "missing_client_id"
                  ? "Google Calendar no está configurado en el servidor (falta GOOGLE_CLIENT_ID)."
                  : gcal === "misconfigured" && reason === "missing_encryption_key"
                    ? "Google Calendar no está configurado en el servidor (falta APP_ENCRYPTION_KEY)."
                    : gcal
                      ? "No se pudo completar la conexión con Google."
                      : null;

    setOauthMessage(message);
  }, []);

  function openReportForm(args: { dateKey: string; dateLabel: string; event: CalendarEvent }) {
    setReportEvent(args);
    setReportMode("create");
    setReportRef({ key: `${args.dateKey}:${args.event.id}`, id: null, createdAt: null, sentAt: null });
    setReportMeetingDate(args.dateKey);
    setReportActivities("");
    setTaskDraft("");
    setTasks([]);
    setEditingTaskId(null);
    setEditingTaskText("");
    setObservationDraft("");
    setObservations([]);
    setEditingObservationId(null);
    setEditingObservationText("");
    setRecipientDraft("");
    setRecipients([]);
    setReportOpen(true);
  }

  function openExistingReport(args: {
    dateKey: string;
    dateLabel: string;
    event: CalendarEvent;
    reportKey: string;
    report: MeetingReportItem;
    mode: "edit" | "view";
  }) {
    setReportEvent({ dateKey: args.dateKey, dateLabel: args.dateLabel, event: args.event });
    setReportMode(args.mode);
    setReportRef({
      key: args.reportKey,
      id: args.report.id,
      createdAt: args.report.createdAt,
      sentAt: typeof args.report.sentAt === "number" ? args.report.sentAt : null,
    });

    setReportMeetingDate(args.report.meetingDate || args.dateKey);
    setReportActivities(args.report.activities || "");
    setTaskDraft("");
    setTasks(Array.isArray(args.report.tasks) ? args.report.tasks : []);
    setEditingTaskId(null);
    setEditingTaskText("");
    setObservationDraft("");
    setObservations(Array.isArray(args.report.observations) ? args.report.observations : []);
    setEditingObservationId(null);
    setEditingObservationText("");
    setRecipientDraft("");
    setRecipients((args.report.recipients || []).map((email) => ({ id: crypto.randomUUID(), email })));
    setReportOpen(true);
  }

  function upsertReport(nextSentAt: number | null) {
    if (!reportEvent || !reportRef) return null;
    const id = reportRef.id || crypto.randomUUID();
    const createdAt = reportRef.createdAt ?? Date.now();
    const report: MeetingReportItem = {
      id,
      meetingDate: reportMeetingDate || reportEvent.dateKey,
      activities: reportActivities.trim(),
      tasks: tasks.filter((t) => t.text.trim().length > 0),
      observations: observations.filter((o) => o.text.trim().length > 0),
      recipients: recipients.map((r) => r.email),
      createdAt,
      sentAt: nextSentAt,
    };

    const key = reportRef.key;
    setSavedReports((prev) => {
      const next = { ...prev };
      const existing = Array.isArray(next[key]) ? next[key] : [];
      const idx = existing.findIndex((x) => x.id === id);
      if (idx >= 0) {
        const copy = [...existing];
        copy[idx] = report;
        next[key] = copy;
      } else {
        next[key] = [report, ...existing];
      }
      return next;
    });

    setReportRef((prev) => (prev ? { ...prev, id, createdAt, sentAt: nextSentAt } : prev));
    return report;
  }

  function markReportSent(reportKey: string, reportId: string, sentAt: number) {
    setSavedReports((prev) => {
      const next = { ...prev };
      const existing = Array.isArray(next[reportKey]) ? next[reportKey] : [];
      const idx = existing.findIndex((x) => x.id === reportId);
      if (idx < 0) return prev;
      const copy = [...existing];
      copy[idx] = { ...copy[idx], sentAt };
      next[reportKey] = copy;
      return next;
    });
    setReportRef((prev) => (prev ? { ...prev, id: reportId, sentAt } : prev));
  }

  function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function parseRecipientsToList() {
    const raw = recipientDraft.trim();
    if (!raw) return;
    const parts = raw
      .split(/[,\s;]+/g)
      .map((x) => x.trim())
      .filter(Boolean);
    const valid = parts.filter(isValidEmail);
    if (valid.length === 0) {
      toast.error("Ingresa correos válidos.");
      return;
    }
    setRecipients((prev) => {
      const set = new Set(prev.map((p) => p.email.toLowerCase()));
      const toAdd = valid
        .map((email) => email.toLowerCase())
        .filter((email) => !set.has(email))
        .map((email) => ({ id: crypto.randomUUID(), email }));
      return [...prev, ...toAdd];
    });
    setRecipientDraft("");
  }

  function eventEnded(e: CalendarEvent) {
    const now = Date.now();
    const startMs = Date.parse(e.startIso);
    const endMs = e.endIso ? Date.parse(e.endIso) : NaN;
    if (!Number.isNaN(endMs)) return now >= endMs;
    if (!Number.isNaN(startMs) && e.startIso.length === 10) {
      const dayEnd = new Date(`${e.startIso}T23:59:59.999`);
      return now >= dayEnd.getTime();
    }
    if (!Number.isNaN(startMs) && e.end) {
      return now >= startMs;
    }
    return false;
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/google-calendar/events?start=${encodeURIComponent(startKey)}&days=5`, {
      cache: "no-store",
    })
      .then(async (r) => {
        const json = (await r.json().catch(() => null)) as EventsResponse | null;
        if (!cancelled) setData(json || { connected: false, error: "No se pudo leer la respuesta." });
      })
      .catch(() => {
        if (!cancelled) setData({ connected: false, error: "No se pudo cargar la agenda." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startKey]);

  const header = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="grid gap-1">
        <div className="text-sm text-slate-600">
          {toBogotaLabel(weekStart)} – {toBogotaLabel(addDays(weekStart, 4))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl"
          onClick={() => setWeekStart((d) => addDays(d, -7))}
          disabled={loading}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Semana anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl"
          onClick={() => setWeekStart((d) => addDays(d, 7))}
          disabled={loading}
        >
          Semana siguiente
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  if (!data || !data.connected) {
    return (
      <Card className="min-w-0">
        <CardHeader className="gap-2">
          <CardTitle>Agenda</CardTitle>
          {header}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-medium text-slate-900">Conectar Google Calendar</div>
            <div className="mt-1 text-sm text-slate-600">
              Por seguridad, Google no permite iniciar sesión con contraseña dentro de otras apps. La conexión se hace con el botón “Conectar con Google”.
            </div>
            {oauthMessage ? <div className="mt-3 text-sm text-red-600">{oauthMessage}</div> : null}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button className="bg-[#D4AF37] text-black hover:bg-[#B59530]" asChild>
                <a href={connectUrl}>Conectar con Google</a>
              </Button>
              <Button variant="outline" asChild>
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center"
                >
                  Ir a Google Calendar
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            </div>
            {data?.error ? (
              <div className="mt-3 text-sm text-red-600">{data.error}</div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>Agenda</CardTitle>
            <div className="text-sm text-slate-600">Cuenta conectada: {data.email}</div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await fetch("/api/google-calendar/disconnect", { method: "POST" });
              } finally {
                setLoading(false);
                setData({ connected: false });
              }
            }}
          >
            Desconectar
          </Button>
        </div>
        {header}
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-5">
          {data.days.map((day) => {
            const d = new Date(`${day.date}T00:00:00`);
            return (
              <div key={day.date} className="min-w-0 rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-3 py-2">
                  <div className="text-sm font-semibold text-slate-900">
                    {weekdayLabel(d)} {toBogotaLabel(d)}
                  </div>
                  <div className="text-xs text-slate-500">{day.events.length} reuniones</div>
                </div>
                <div className="p-3">
                  {day.events.length === 0 ? (
                    <div className="text-sm text-slate-500">Sin reuniones</div>
                  ) : (
                    <div className="space-y-2">
                      {day.events.map((e) => {
                        const ended = eventEnded(e);
                        const reportKey = `${day.date}:${e.id}`;
                        const reports = savedReports[reportKey] || [];
                        return (
                          <div
                            key={e.id}
                            className={
                              ended
                                ? "rounded-lg border border-slate-300 bg-slate-100 p-2 shadow-sm"
                                : "rounded-lg border border-emerald-300 bg-emerald-50 p-2 shadow-sm"
                            }
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-900 line-clamp-2">
                                  {e.summary || "(Sin título)"}
                                </div>
                                <div className="mt-1 text-xs text-slate-600">
                                  {e.start} {e.end ? `– ${e.end}` : ""}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8 rounded-lg px-2 text-xs"
                                  onClick={() =>
                                    openReportForm({
                                      dateKey: day.date,
                                      dateLabel: `${weekdayLabel(d)} ${toBogotaLabel(d)}`,
                                      event: e,
                                    })
                                  }
                                >
                                  Agregar Reporte
                                </Button>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-2">
                              {e.htmlLink ? (
                                <a
                                  href={e.htmlLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex text-xs text-[#B59530] hover:underline"
                                >
                                  Ver en Google Calendar
                                </a>
                              ) : (
                                <div />
                              )}
                              <div className={ended ? "text-[11px] font-semibold text-slate-600" : "text-[11px] font-semibold text-emerald-800"}>
                                {ended ? "Finalizada" : "Pendiente"}
                              </div>
                            </div>

                            {reports.length > 0 ? (
                              <div className="mt-3 space-y-2">
                                {reports.map((r) => (
                                  <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <div className="text-xs font-semibold text-slate-900">Reporte</div>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          className="h-7 rounded-lg px-2 text-[11px]"
                                          onClick={() =>
                                            openExistingReport({
                                              dateKey: day.date,
                                              dateLabel: `${weekdayLabel(d)} ${toBogotaLabel(d)}`,
                                              event: e,
                                              reportKey,
                                              report: r,
                                              mode: "view",
                                            })
                                          }
                                        >
                                          Ver
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          className="h-7 rounded-lg px-2 text-[11px]"
                                          onClick={() =>
                                            openExistingReport({
                                              dateKey: day.date,
                                              dateLabel: `${weekdayLabel(d)} ${toBogotaLabel(d)}`,
                                              event: e,
                                              reportKey,
                                              report: r,
                                              mode: "edit",
                                            })
                                          }
                                        >
                                          Editar
                                        </Button>
                                      </div>
                                      <div className="text-[11px] text-slate-500">
                                        {new Date(r.createdAt).toLocaleString("es-CO")}
                                        {r.sentAt ? " · Enviado" : ""}
                                      </div>
                                    </div>
                                    {r.activities ? (
                                      <div className="mt-2 text-xs text-slate-700 whitespace-pre-wrap">{r.activities}</div>
                                    ) : null}
                                    {r.tasks.length > 0 ? (
                                      <div className="mt-2">
                                        <div className="text-[11px] font-semibold text-slate-700">Tareas</div>
                                        <ul className="mt-1 space-y-1">
                                          {r.tasks.map((t) => (
                                            <li key={t.id} className="text-xs text-slate-700">
                                              - {t.text}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : null}
                                    {r.observations.length > 0 ? (
                                      <div className="mt-2">
                                        <div className="text-[11px] font-semibold text-slate-700">Observaciones</div>
                                        <ul className="mt-1 space-y-1">
                                          {r.observations.map((o) => (
                                            <li key={o.id} className="text-xs text-slate-700">
                                              - {o.text}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : null}
                                    {r.recipients.length > 0 ? (
                                      <div className="mt-2 text-[11px] text-slate-500">
                                        Para: {r.recipients.join(", ")}
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90dvh] overflow-hidden p-0">
            <div className="flex max-h-[90dvh] flex-col">
              <DialogHeader className="border-b border-slate-200 bg-white px-6 py-4">
                <DialogTitle>
                  {reportMode === "view" ? "Ver Reporte" : reportMode === "edit" ? "Editar Reporte" : "Agregar Reporte"}
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {reportEvent ? (
                  <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-900">{reportEvent.event.summary || "(Sin título)"}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {reportEvent.dateLabel} · {reportEvent.event.start} {reportEvent.event.end ? `– ${reportEvent.event.end}` : ""}
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="text-sm font-medium text-slate-900">Fecha de la reunión</div>
                  <Input value={reportMeetingDate} readOnly />
                </div>

                <div className="grid gap-2">
                  <div className="text-sm font-medium text-slate-900">Actividades ejecutadas</div>
                  <Textarea
                    value={reportActivities}
                    onChange={(e) => setReportActivities(e.target.value)}
                    placeholder="Describe las actividades realizadas..."
                    className="min-h-28"
                    disabled={reportMode === "view"}
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-sm font-semibold text-slate-900">Tareas asignadas</div>
                  {reportMode !== "view" ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Input value={taskDraft} onChange={(e) => setTaskDraft(e.target.value)} placeholder="Escribe una tarea..." />
                      <Button
                        type="button"
                        className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
                        onClick={() => {
                          const text = taskDraft.trim();
                          if (!text) return;
                          setTasks((prev) => [...prev, { id: crypto.randomUUID(), text }]);
                          setTaskDraft("");
                        }}
                      >
                        Agregar
                      </Button>
                    </div>
                  ) : null}
                  {tasks.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {tasks.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                          {reportMode === "view" ? (
                            <div className="flex-1 text-sm text-slate-800">{t.text}</div>
                          ) : (
                            <>
                              {editingTaskId === t.id ? (
                                <Input value={editingTaskText} onChange={(e) => setEditingTaskText(e.target.value)} />
                              ) : (
                                <div className="flex-1 text-sm text-slate-800">{t.text}</div>
                              )}
                              {editingTaskId === t.id ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 rounded-lg px-2 text-xs"
                                    onClick={() => {
                                      const next = editingTaskText.trim();
                                      if (!next) return;
                                      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, text: next } : x)));
                                      setEditingTaskId(null);
                                      setEditingTaskText("");
                                    }}
                                  >
                                    Guardar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 rounded-lg px-2 text-xs"
                                    onClick={() => {
                                      setEditingTaskId(null);
                                      setEditingTaskText("");
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 rounded-lg px-2 text-xs"
                                    onClick={() => {
                                      setEditingTaskId(t.id);
                                      setEditingTaskText(t.text);
                                    }}
                                  >
                                    Editar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 rounded-lg px-2 text-xs"
                                    onClick={() => setTasks((prev) => prev.filter((x) => x.id !== t.id))}
                                  >
                                    Eliminar
                                  </Button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-sm font-semibold text-slate-900">Observaciones</div>
                  {reportMode !== "view" ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        value={observationDraft}
                        onChange={(e) => setObservationDraft(e.target.value)}
                        placeholder="Escribe una observación..."
                      />
                      <Button
                        type="button"
                        className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
                        onClick={() => {
                          const text = observationDraft.trim();
                          if (!text) return;
                          setObservations((prev) => [...prev, { id: crypto.randomUUID(), text }]);
                          setObservationDraft("");
                        }}
                      >
                        Agregar
                      </Button>
                    </div>
                  ) : null}
                  {observations.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {observations.map((o) => (
                        <div key={o.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                          {reportMode === "view" ? (
                            <div className="flex-1 text-sm text-slate-800">{o.text}</div>
                          ) : (
                            <>
                              {editingObservationId === o.id ? (
                                <Input value={editingObservationText} onChange={(e) => setEditingObservationText(e.target.value)} />
                              ) : (
                                <div className="flex-1 text-sm text-slate-800">{o.text}</div>
                              )}
                              {editingObservationId === o.id ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 rounded-lg px-2 text-xs"
                                    onClick={() => {
                                      const next = editingObservationText.trim();
                                      if (!next) return;
                                      setObservations((prev) => prev.map((x) => (x.id === o.id ? { ...x, text: next } : x)));
                                      setEditingObservationId(null);
                                      setEditingObservationText("");
                                    }}
                                  >
                                    Guardar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 rounded-lg px-2 text-xs"
                                    onClick={() => {
                                      setEditingObservationId(null);
                                      setEditingObservationText("");
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 rounded-lg px-2 text-xs"
                                    onClick={() => {
                                      setEditingObservationId(o.id);
                                      setEditingObservationText(o.text);
                                    }}
                                  >
                                    Editar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 rounded-lg px-2 text-xs"
                                    onClick={() => setObservations((prev) => prev.filter((x) => x.id !== o.id))}
                                  >
                                    Eliminar
                                  </Button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-sm font-semibold text-slate-900">Correos para enviar el reporte</div>
                  {reportMode !== "view" ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        value={recipientDraft}
                        onChange={(e) => setRecipientDraft(e.target.value)}
                        placeholder="ej: cliente@empresa.com, otro@empresa.com"
                      />
                      <Button type="button" className="bg-[#D4AF37] text-black hover:bg-[#B59530]" onClick={parseRecipientsToList}>
                        Agregar
                      </Button>
                    </div>
                  ) : null}
                  {recipients.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {recipients.map((r) => (
                        <div key={r.id} className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                          <div className="text-xs text-slate-700">{r.email}</div>
                          {reportMode !== "view" ? (
                            <button
                              type="button"
                              className="text-xs text-slate-500 hover:text-slate-900"
                              onClick={() => setRecipients((prev) => prev.filter((x) => x.id !== r.id))}
                            >
                              Quitar
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                  </div>
                ) : null}
              </div>

              <DialogFooter className="gap-2 border-t border-slate-200 bg-white px-6 py-4 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReportOpen(false);
                }}
                disabled={reportSending}
              >
                {reportMode === "view" ? "Cerrar" : "Cancelar"}
              </Button>
              {reportMode !== "view" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const r = upsertReport(reportRef?.sentAt ?? null);
                      if (r) toast.success("Reporte guardado.");
                      setReportOpen(false);
                    }}
                    disabled={reportSending}
                  >
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
                    onClick={async () => {
                      if (reportSending) return;
                      if (!reportEvent) return;
                      if (recipients.length === 0) {
                        toast.error("Agrega al menos un correo para enviar.");
                        return;
                      }
                      const key = reportRef?.key || `${reportEvent.dateKey}:${reportEvent.event.id}`;
                      const draft = upsertReport(reportRef?.sentAt ?? null);
                      if (!draft) return;
                      setReportSending(true);
                      try {
                        const res = await sendAgendaMeetingReport({
                          projectId: props.projectId,
                          meetingTitle: reportEvent.event.summary || "(Sin título)",
                          meetingDate: draft.meetingDate,
                          meetingStart: reportEvent.event.start,
                          meetingEnd: reportEvent.event.end,
                          activities: draft.activities,
                          tasks: draft.tasks.map((t) => t.text),
                          observations: draft.observations.map((o) => o.text),
                          recipients: draft.recipients,
                        });
                        if (!res?.success) {
                          toast.error(res?.error || "No se pudo enviar el reporte.");
                          return;
                        }
                        markReportSent(key, draft.id, Date.now());
                        toast.success("Reporte enviado.");
                      } catch {
                        toast.error("No se pudo enviar el reporte.");
                      } finally {
                        setReportSending(false);
                        setReportOpen(false);
                      }
                    }}
                    disabled={reportSending}
                  >
                    {reportSending ? "Enviando..." : "Enviar"}
                  </Button>
                </>
              ) : null}
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
