"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  listLearningCourses,
  createLearningCourse,
  getLearningStudentState,
  markLearningModuleCompleted,
  submitLearningExamAttempt,
  searchLearningStudents,
  getLearningCourseEnrollments,
  addStudentsToLearningCourse,
  removeStudentFromLearningCourse,
} from "@/app/learning-actions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { BookOpen, GraduationCap, ListChecks, Plus, Settings, ShieldCheck } from "lucide-react";
import { jsPDF } from "jspdf";

type UserRole = "ADMIN_PMD" | "CLIENT" | "CLIENT_VIEWER" | string;

type ProjectOption = {
  id: string;
  name: string;
  clientName: string;
  status: string;
};

type LearningModule = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  youtubeVideoId: string;
  materialsJson: string;
};

type LearningExamQuestion = {
  id: string;
  prompt: string;
  optionsJson: string;
  correctIndex: number;
  order: number;
};

type LearningExam = {
  id: string;
  passingScorePercent: number;
  questions: LearningExamQuestion[];
};

type LearningCourse = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  certificateEnabled: boolean;
  createdAt: string;
  modules: LearningModule[];
  exam: LearningExam | null;
};

type StudentState = {
  progress: Array<{ moduleId: string; completedAt: string }>;
  certificates: Array<{ courseId: string; issuedAt: string }>;
};

function getErrorMessage(e: unknown, fallback: string) {
  if (e && typeof e === "object" && "message" in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return fallback;
}

function parseMaterials(materialsJson: string) {
  try {
    const parsed = JSON.parse(materialsJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x) => (typeof x === "string" ? x : "")).filter(Boolean);
  } catch {
    return [];
  }
}

function percent(num: number, den: number) {
  if (den <= 0) return 0;
  const p = Math.round((num / den) * 100);
  return Math.max(0, Math.min(100, p));
}

function CourseCover(props: { url: string | null; title: string }) {
  if (!props.url) {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 sm:h-40 md:h-44 lg:h-48">
        <GraduationCap className="h-8 w-8 text-slate-500" />
      </div>
    );
  }
  return (
    <div className="h-32 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:h-40 md:h-44 lg:h-48">
      <img src={props.url} alt={props.title} className="h-full w-full object-cover" />
    </div>
  );
}

function ProgressBar(props: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${props.value}%` }} />
    </div>
  );
}

function CourseCreateDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  canChooseAssignee?: boolean;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [certificateEnabled, setCertificateEnabled] = useState(true);
  const [cover, setCover] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [modules, setModules] = useState<Array<{ title: string; description: string; youtube: string; materials: string }>>([
    { title: "Módulo 1", description: "", youtube: "", materials: "" },
  ]);

  const [examEnabled, setExamEnabled] = useState(true);
  const [passingScorePercent, setPassingScorePercent] = useState("70");
  const [questions, setQuestions] = useState<
    Array<{ prompt: string; a: string; b: string; c: string; d: string; correct: "0" | "1" | "2" | "3" }>
  >([{ prompt: "", a: "", b: "", c: "", d: "", correct: "0" }]);

  useEffect(() => {
    if (!props.open) return;
    setTitle("");
    setDescription("");
    setCertificateEnabled(true);
    setCover(null);
    setSaving(false);
    setModules([{ title: "Módulo 1", description: "", youtube: "", materials: "" }]);
    setExamEnabled(true);
    setPassingScorePercent("70");
    setQuestions([{ prompt: "", a: "", b: "", c: "", d: "", correct: "0" }]);
  }, [props.open]);

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    const validModules = modules.every((m) => m.title.trim() && Boolean(extractYouTubeVideoId(m.youtube)));
    if (!validModules) return false;
    if (!examEnabled) return true;
    const p = Number(passingScorePercent);
    if (!Number.isFinite(p) || p < 0 || p > 100) return false;
    const validQuestions = questions.filter((q) => q.prompt.trim()).length >= 1;
    if (!validQuestions) return false;
    return true;
  }, [examEnabled, modules, passingScorePercent, questions, title]);

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const payload = {
        projectId: props.projectId,
        title: title.trim(),
        description: description.trim() || null,
        certificateEnabled,
        modules: modules.map((m) => ({
          title: m.title.trim(),
          description: m.description.trim() || null,
          youtube: m.youtube.trim(),
          materials: m.materials
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
        })),
        exam: examEnabled
          ? {
              passingScorePercent: Number(passingScorePercent),
              questions: questions
                .map((q) => ({
                  prompt: q.prompt.trim(),
                  options: [q.a, q.b, q.c, q.d].map((x) => x.trim()).filter(Boolean),
                  correctIndex: Number(q.correct),
                }))
                .filter((q) => q.prompt && q.options.length >= 2),
            }
          : null,
      };

      const fd = new FormData();
      fd.append("payload", JSON.stringify(payload));
      if (cover) fd.append("cover", cover);

      const res = await createLearningCourse(fd);
      if (!res.success) throw new Error(res.error || "No se pudo crear el curso.");
      toast.success("Curso creado");
      props.onCreated();
      props.onOpenChange(false);
    } catch (e) {
      toast.error(getErrorMessage(e, "No se pudo crear el curso"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-3xl overflow-y-auto max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Nuevo curso</DialogTitle>
          <DialogDescription>Sube cursos por módulos usando videos de YouTube.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-2">
                <div className="text-sm font-medium text-slate-700">Nombre del curso</div>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Inducción SST" />
              </div>
              <div className="grid gap-2">
                <div className="text-sm font-medium text-slate-700">Descripción</div>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción del curso" />
              </div>
              <div className="grid gap-2">
                <div className="text-sm font-medium text-slate-700">Carátula</div>
                <Input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] || null)} />
                <div className="text-xs text-slate-500">Máximo 12MB.</div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">Certificado</div>
                  <div className="text-xs text-slate-600">Permite descargar certificado si aprueba el examen</div>
                </div>
                <Button
                  type="button"
                  variant={certificateEnabled ? "default" : "outline"}
                  className={certificateEnabled ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                  onClick={() => setCertificateEnabled((v) => !v)}
                >
                  {certificateEnabled ? "Activo" : "Inactivo"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Módulos</CardTitle>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => setModules((prev) => [...prev, { title: `Módulo ${prev.length + 1}`, description: "", youtube: "", materials: "" }])}
              >
                <Plus className="h-4 w-4" />
                Agregar módulo
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4">
              {modules.map((m, idx) => {
                const videoId = extractYouTubeVideoId(m.youtube);
                return (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">Módulo {idx + 1}</div>
                      {modules.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setModules((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Eliminar
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-3">
                      <div className="grid gap-2">
                        <div className="text-sm font-medium text-slate-700">Nombre</div>
                        <Input
                          value={m.title}
                          onChange={(e) =>
                            setModules((prev) => prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <div className="text-sm font-medium text-slate-700">Video</div>
                        <Input
                          value={m.youtube}
                          onChange={(e) =>
                            setModules((prev) => prev.map((x, i) => (i === idx ? { ...x, youtube: e.target.value } : x)))
                          }
                          placeholder="Pega el link de YouTube o el ID"
                        />
                        {m.youtube.trim() ? (
                          videoId ? (
                            <div className="text-xs text-emerald-700">Video configurado</div>
                          ) : (
                            <div className="text-xs text-red-600">Link de YouTube inválido</div>
                          )
                        ) : null}
                      </div>
                      <div className="grid gap-2">
                        <div className="text-sm font-medium text-slate-700">Descripción</div>
                        <Textarea
                          value={m.description}
                          onChange={(e) =>
                            setModules((prev) => prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <div className="text-sm font-medium text-slate-700">Material (links, uno por línea)</div>
                        <Textarea
                          value={m.materials}
                          onChange={(e) =>
                            setModules((prev) => prev.map((x, i) => (i === idx ? { ...x, materials: e.target.value } : x)))
                          }
                          placeholder="https://... "
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Examen</CardTitle>
              <Button
                type="button"
                variant={examEnabled ? "default" : "outline"}
                className={
                  examEnabled
                    ? "bg-slate-900 text-white hover:bg-slate-800 hover:text-white focus-visible:ring-slate-900/40"
                    : "text-slate-900"
                }
                onClick={() => setExamEnabled((v) => !v)}
              >
                {examEnabled ? "Activo" : "Inactivo"}
              </Button>
            </CardHeader>
            {examEnabled ? (
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <div className="text-sm font-medium text-slate-700">Puntaje mínimo (%)</div>
                  <Input value={passingScorePercent} onChange={(e) => setPassingScorePercent(e.target.value)} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Preguntas</div>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => setQuestions((prev) => [...prev, { prompt: "", a: "", b: "", c: "", d: "", correct: "0" }])}
                  >
                    <Plus className="h-4 w-4" />
                    Agregar
                  </Button>
                </div>
                <div className="grid gap-4">
                  {questions.map((q, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">Pregunta {idx + 1}</div>
                        {questions.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            Eliminar
                          </Button>
                        ) : null}
                      </div>
                      <div className="mt-3 grid gap-3">
                        <Textarea
                          value={q.prompt}
                          onChange={(e) => setQuestions((prev) => prev.map((x, i) => (i === idx ? { ...x, prompt: e.target.value } : x)))}
                          placeholder="Enunciado"
                        />
                        <div className="grid gap-2">
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {(["a", "b", "c", "d"] as const).map((k, oIdx) => (
                              <Input
                                key={k}
                                value={q[k]}
                                onChange={(e) =>
                                  setQuestions((prev) =>
                                    prev.map((x, i) => (i === idx ? { ...x, [k]: e.target.value } : x))
                                  )
                                }
                                placeholder={`Opción ${oIdx + 1}`}
                              />
                            ))}
                          </div>
                          <div className="grid gap-2">
                            <div className="text-sm font-medium text-slate-700">Respuesta correcta</div>
                            <Select
                              value={q.correct}
                              onValueChange={(v) =>
                                setQuestions((prev) =>
                                  prev.map((x, i) => {
                                    if (i !== idx) return x;
                                    const next =
                                      v === "0" || v === "1" || v === "2" || v === "3"
                                        ? (v as "0" | "1" | "2" | "3")
                                        : "0";
                                    return { ...x, correct: next };
                                  })
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">Opción 1</SelectItem>
                                <SelectItem value="1">Opción 2</SelectItem>
                                <SelectItem value="2">Opción 3</SelectItem>
                                <SelectItem value="3">Opción 4</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            ) : null}
          </Card>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit || saving} className="bg-[#D4AF37] hover:bg-[#c49f2f] text-black">
            {saving ? "Guardando…" : "Crear curso"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type CourseStudent = { id: string; email: string; name: string; assignedAt?: string };

function CourseStudentsDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseTitle: string;
  currentUserRole: string;
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; email: string; name: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addingSelected, setAddingSelected] = useState(false);

  const [loadingAssigned, setLoadingAssigned] = useState(false);
  const [assigned, setAssigned] = useState<CourseStudent[]>([]);

  const refreshAssigned = useCallback(async () => {
    if (!props.courseId) return;
    setLoadingAssigned(true);
    try {
      const res = await getLearningCourseEnrollments(props.courseId);
      if (!res.success) throw new Error(res.error || "No se pudo cargar");
      setAssigned((res.students as unknown as CourseStudent[]) || []);
    } catch (e) {
      toast.error(getErrorMessage(e, "No se pudo cargar estudiantes"));
    } finally {
      setLoadingAssigned(false);
    }
  }, [props.courseId]);

  useEffect(() => {
    if (!props.open) return;
    setQuery("");
    setResults([]);
    setSelectedIds([]);
    void refreshAssigned();
  }, [props.open, refreshAssigned]);

  useEffect(() => {
    if (!props.open) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchLearningStudents(q);
        if (!res.success) throw new Error(res.error || "No se pudo buscar");
        setResults((res.students as unknown as Array<{ id: string; email: string; name: string }>) || []);
      } catch (e) {
        toast.error(getErrorMessage(e, "No se pudo buscar estudiantes"));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [props.open, query]);

  const assignedSet = useMemo(() => new Set(assigned.map((s) => s.id)), [assigned]);

  const toggleSelected = (studentId: string) => {
    setSelectedIds((prev) => (prev.includes(studentId) ? prev.filter((x) => x !== studentId) : [...prev, studentId]));
  };

  const addOne = async (studentId: string) => {
    try {
      const res = await addStudentsToLearningCourse(props.courseId, [studentId]);
      if (!res.success) throw new Error(res.error || "No se pudo asignar");
      toast.success("Estudiante asignado");
      await refreshAssigned();
    } catch (e) {
      toast.error(getErrorMessage(e, "No se pudo asignar"));
    }
  };

  const addSelected = async () => {
    const ids = selectedIds.filter((id) => !assignedSet.has(id));
    if (ids.length === 0) {
      toast.error("Selecciona al menos 1 estudiante");
      return;
    }
    setAddingSelected(true);
    try {
      const res = await addStudentsToLearningCourse(props.courseId, ids);
      if (!res.success) throw new Error(res.error || "No se pudo asignar");
      toast.success(ids.length === 1 ? "Estudiante asignado" : `${ids.length} estudiantes asignados`);
      setSelectedIds([]);
      await refreshAssigned();
    } catch (e) {
      toast.error(getErrorMessage(e, "No se pudo asignar"));
    } finally {
      setAddingSelected(false);
    }
  };

  const removeOne = async (studentId: string) => {
    try {
      const res = await removeStudentFromLearningCourse(props.courseId, studentId);
      if (!res.success) throw new Error(res.error || "No se pudo quitar");
      toast.success("Estudiante removido");
      await refreshAssigned();
    } catch (e) {
      toast.error(getErrorMessage(e, "No se pudo quitar"));
    }
  };

  const hint =
    props.currentUserRole === "ADMIN_PMD"
      ? "Busca por correo o nombre."
      : "Escribe el correo completo del estudiante para buscarlo.";

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Asignar estudiantes</DialogTitle>
          <DialogDescription className="break-words">
            Curso: <span className="font-semibold text-slate-900">{props.courseTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="text-sm font-semibold text-slate-900">Buscar estudiante</div>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="correo@empresa.com" />
            <div className="text-xs text-slate-600">{hint}</div>
          </div>

          <div className="grid gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold text-slate-900">Resultados</div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-slate-900 text-white hover:bg-slate-800"
                  onClick={() => void addSelected()}
                  disabled={addingSelected || selectedIds.length === 0}
                >
                  Agregar seleccionados ({selectedIds.length})
                </Button>
                {selectedIds.length > 0 ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => setSelectedIds([])} disabled={addingSelected}>
                    Limpiar
                  </Button>
                ) : null}
              </div>
            </div>
            {searching ? (
              <div className="text-sm text-slate-600">Buscando…</div>
            ) : results.length === 0 ? (
              <div className="text-sm text-slate-600">Sin resultados</div>
            ) : (
              <div className="grid gap-2">
                {results.map((s) => {
                  const already = assignedSet.has(s.id);
                  const selected = selectedIds.includes(s.id);
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="flex min-w-0 items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-slate-900"
                          checked={selected}
                          disabled={already}
                          onChange={() => toggleSelected(s.id)}
                        />
                        <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{s.name || "Estudiante"}</div>
                        <div className="truncate text-xs text-slate-600">{s.email}</div>
                        </div>
                      </div>
                      <Button type="button" variant="outline" disabled={already} onClick={() => void addOne(s.id)}>
                        {already ? "Asignado" : "Agregar"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">Asignados a este curso</div>
              <Button type="button" variant="outline" size="sm" onClick={() => void refreshAssigned()} disabled={loadingAssigned}>
                Actualizar
              </Button>
            </div>
            {loadingAssigned ? (
              <div className="text-sm text-slate-600">Cargando…</div>
            ) : assigned.length === 0 ? (
              <div className="text-sm text-slate-600">Aún no hay estudiantes asignados.</div>
            ) : (
              <div className="grid gap-2">
                {assigned.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{s.name || "Estudiante"}</div>
                      <div className="truncate text-xs text-slate-600">{s.email}</div>
                    </div>
                    <Button type="button" variant="destructive" onClick={() => void removeOne(s.id)}>
                      Quitar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StudentCourseView(props: {
  course: LearningCourse;
  currentUser: { id: string; name: string; role: UserRole };
  studentState: StudentState;
  onCompleted: (moduleId: string) => void;
  onExamSubmitted: (examId: string, scorePercent: number, passed: boolean, courseId: string) => void;
}) {
  const completedSet = useMemo(() => new Set(props.studentState.progress.map((p) => p.moduleId)), [props.studentState.progress]);
  const certificateSet = useMemo(() => new Set(props.studentState.certificates.map((c) => c.courseId)), [props.studentState.certificates]);
  const totalModules = props.course.modules.length;
  const completedModules = props.course.modules.filter((m) => completedSet.has(m.id)).length;
  const progress = percent(completedModules, totalModules);

  const [activeModuleId, setActiveModuleId] = useState<string | null>(props.course.modules[0]?.id || null);
  const activeModule = props.course.modules.find((m) => m.id === activeModuleId) || props.course.modules[0] || null;

  const allCompleted = totalModules > 0 && completedModules === totalModules;
  const canTakeExam = Boolean(props.course.exam && allCompleted);

  const [takingExam, setTakingExam] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const examQuestions = props.course.exam?.questions || [];
  const passedAlready = certificateSet.has(props.course.id);

  const downloadCertificate = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();

    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, w, h, "F");
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(3);
    doc.rect(24, 24, w - 48, h - 48, "S");

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(34);
    doc.text("Certificado", w / 2, 120, { align: "center" });

    doc.setFontSize(14);
    doc.setTextColor(71, 85, 105);
    doc.text("Se certifica que", w / 2, 165, { align: "center" });

    doc.setFontSize(26);
    doc.setTextColor(15, 23, 42);
    doc.text(props.currentUser.name || "Estudiante", w / 2, 215, { align: "center" });

    doc.setFontSize(14);
    doc.setTextColor(71, 85, 105);
    doc.text("ha completado y aprobado el curso", w / 2, 250, { align: "center" });

    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    doc.text(props.course.title, w / 2, 295, { align: "center", maxWidth: w - 140 });

    const date = new Date().toLocaleDateString("es-CO");
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text(`Fecha: ${date}`, w / 2, h - 90, { align: "center" });

    doc.save(`Certificado - ${props.course.title}.pdf`);
  };

  const submitExam = async () => {
    if (!props.course.exam) return;
    const ordered = examQuestions.map((q) => answers[q.id]);
    if (ordered.some((a) => typeof a !== "number")) {
      toast.error("Responde todas las preguntas.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitLearningExamAttempt(props.course.exam.id, ordered.map((x) => Number(x)));
      if (!res.success) throw new Error(res.error || "No se pudo enviar el examen.");
      props.onExamSubmitted(props.course.exam.id, res.scorePercent, res.passed, res.courseId);
      if (res.passed) {
        toast.success(`Aprobado (${res.scorePercent}%)`);
      } else {
        toast.error(`No aprobado (${res.scorePercent}%)`);
      }
      setTakingExam(false);
    } catch (e) {
      toast.error(getErrorMessage(e, "No se pudo enviar el examen"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-slate-700" />
                <div className="min-w-0 text-lg font-semibold leading-tight text-slate-900 break-words">{props.course.title}</div>
              </div>
              {props.course.description ? (
                <div className="mt-1 line-clamp-3 text-sm text-slate-600 break-words">{props.course.description}</div>
              ) : null}
            </div>
            <div className="w-full md:w-64">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
                <span>Progreso</span>
                <span>{progress}%</span>
              </div>
              <ProgressBar value={progress} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Módulos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {props.course.modules.map((m) => {
              const done = completedSet.has(m.id);
              const active = m.id === activeModule?.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveModuleId(m.id)}
                  className={cn(
                    "w-full overflow-hidden rounded-xl border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-[#D4AF37]/70 bg-white shadow-sm ring-1 ring-[#D4AF37]/20"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full",
                            active ? "bg-[#D4AF37]" : "bg-slate-300"
                          )}
                        />
                        <div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                          {m.order}. {m.title}
                        </div>
                      </div>
                      {m.description ? (
                        <div className="min-w-0 truncate text-xs text-slate-600">{m.description}</div>
                      ) : null}
                    </div>
                    {done ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Listo</Badge> : null}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:col-span-9">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="min-w-0 flex-1 truncate text-base">
                {activeModule ? activeModule.title : "Módulo"}
              </CardTitle>
              {activeModule ? (
                <Button
                  type="button"
                  variant={completedSet.has(activeModule.id) ? "outline" : "default"}
                  className={cn("w-full sm:w-auto", completedSet.has(activeModule.id) ? "" : "bg-emerald-600 hover:bg-emerald-700")}
                  onClick={() => props.onCompleted(activeModule.id)}
                >
                  {completedSet.has(activeModule.id) ? "Completado" : "Marcar como completado"}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-4">
              {activeModule ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
                  <iframe
                    title={activeModule.title}
                    src={`https://www.youtube-nocookie.com/embed/${activeModule.youtubeVideoId}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3`}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                  <div className="pointer-events-auto absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-full bg-sky-600 text-[10px] font-semibold text-white shadow-sm">
                    SG-SST-IA
                  </div>
                  <div className="pointer-events-auto absolute bottom-3 right-3 flex h-11 items-center justify-center rounded-full bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm">
                    Formación SG-SST-IA
                  </div>
                </div>
              ) : null}
              {activeModule ? (
                <div className="grid gap-2">
                  <div className="text-sm font-semibold text-slate-900">Material</div>
                  {parseMaterials(activeModule.materialsJson).length === 0 ? (
                    <div className="text-sm text-slate-600">Sin material</div>
                  ) : (
                    <div className="grid gap-2">
                      {parseMaterials(activeModule.materialsJson).map((u, idx) => (
                        <a key={idx} href={u} target="_blank" rel="noreferrer" className="text-sm text-blue-700 underline">
                          {u}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Examen y certificado</CardTitle>
              {passedAlready ? (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Certificado listo</Badge>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-3">
              {props.course.exam ? (
                <>
                  <div className="text-sm text-slate-600">
                    Puntaje mínimo: <span className="font-semibold text-slate-900">{props.course.exam.passingScorePercent}%</span>
                  </div>
                  {!canTakeExam ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      Completa todos los módulos para habilitar el examen.
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2 md:flex-row">
                    <Button
                      type="button"
                      onClick={() => setTakingExam((v) => !v)}
                      disabled={!canTakeExam}
                      className="bg-sky-600 hover:bg-sky-700 text-white"
                    >
                      <ListChecks className="mr-2 h-4 w-4" />
                      Tomar examen
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={downloadCertificate}
                      disabled={!passedAlready || !props.course.certificateEnabled}
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Descargar certificado
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-600">Este curso no tiene examen.</div>
              )}

              {takingExam && props.course.exam ? (
                <div className="mt-2 grid gap-4 rounded-xl border border-slate-200 bg-white p-4">
                  {examQuestions.map((q, idx) => {
                    const opts = (() => {
                      try {
                        const parsed = JSON.parse(q.optionsJson) as unknown;
                        if (!Array.isArray(parsed)) return [];
                        return parsed.map((x) => (typeof x === "string" ? x : "")).filter(Boolean);
                      } catch {
                        return [];
                      }
                    })();
                    return (
                      <div key={q.id} className="grid gap-2">
                        <div className="text-sm font-semibold text-slate-900">
                          {idx + 1}. {q.prompt}
                        </div>
                        <div className="grid gap-2">
                          {opts.map((o, oIdx) => (
                            <label key={oIdx} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                              <input
                                type="radio"
                                name={q.id}
                                checked={answers[q.id] === oIdx}
                                onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: oIdx }))}
                              />
                              <span className="text-sm text-slate-800">{o}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setTakingExam(false)} disabled={submitting}>
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={submitExam}
                      disabled={submitting}
                      className="bg-slate-900 text-white hover:bg-slate-800 hover:text-white focus-visible:ring-slate-900/40"
                    >
                      {submitting ? "Enviando…" : "Enviar examen"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function LearningPageClient(props: {
  currentUser: { id: string; name: string; role: UserRole };
  projects: ProjectOption[];
  initialProjectId: string | null;
  aiBanner?: { message: string; courseTitle: string } | null;
}) {
  const [projectId, setProjectId] = useState(props.initialProjectId);
  const isStudentOnly = props.currentUser.role === "STUDENT";
  const [mode, setMode] = useState<"manage" | "student">(() => (isStudentOnly ? "student" : "manage"));
  const effectiveMode: "manage" | "student" = isStudentOnly ? "student" : mode;

  const [courses, setCourses] = useState<LearningCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [studentState, setStudentState] = useState<StudentState>({ progress: [], certificates: [] });
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [studentsOpen, setStudentsOpen] = useState(false);
  const [studentsCourse, setStudentsCourse] = useState<{ id: string; title: string } | null>(null);

  const refreshCourses = useCallback(async () => {
    if (!projectId) return;
    setLoadingCourses(true);
    try {
      const res = await listLearningCourses(projectId);
      if (!res.success) throw new Error(res.error || "No se pudo cargar");
      setCourses(res.courses as unknown as LearningCourse[]);
    } catch (e) {
      toast.error(getErrorMessage(e, "No se pudo cargar cursos"));
    } finally {
      setLoadingCourses(false);
    }
  }, [projectId]);

  const refreshStudent = useCallback(async () => {
    if (!projectId) return;
    setLoadingStudent(true);
    try {
      const res = await getLearningStudentState(projectId);
      if (!res.success) throw new Error(res.error || "No se pudo cargar");
      setStudentState({
        progress: res.progress as unknown as StudentState["progress"],
        certificates: res.certificates as unknown as StudentState["certificates"],
      });
    } catch (e) {
      toast.error(getErrorMessage(e, "No se pudo cargar progreso"));
    } finally {
      setLoadingStudent(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refreshCourses();
    void refreshStudent();
  }, [refreshCourses, refreshStudent]);

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const selectedCourse = useMemo(() => courses.find((c) => c.id === selectedCourseId) || null, [courses, selectedCourseId]);

  useEffect(() => {
    if (!selectedCourseId && courses[0]?.id) setSelectedCourseId(courses[0].id);
    if (selectedCourseId && !courses.find((c) => c.id === selectedCourseId)) setSelectedCourseId(courses[0]?.id || null);
  }, [courses, selectedCourseId]);

  const handleCompleteModule = async (moduleId: string) => {
    try {
      const res = await markLearningModuleCompleted(moduleId);
      if (!res.success) throw new Error(res.error || "No se pudo actualizar");
      await refreshStudent();
    } catch (e) {
      toast.error(getErrorMessage(e, "No se pudo marcar"));
    }
  };

  const onExamSubmitted = async () => {
    await refreshStudent();
  };

  const projectLabel = useMemo(() => {
    const p = props.projects.find((x) => x.id === projectId);
    if (!p) return "";
    return `${p.name} — ${p.clientName}`;
  }, [projectId, props.projects]);
  const selectedProject = useMemo(() => props.projects.find((x) => x.id === projectId) || null, [projectId, props.projects]);

  return (
    <div className="grid w-full max-w-none gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-2xl font-semibold text-slate-900">Formación empresarial</div>
          <div className="mt-1 text-sm text-slate-600">Crea cursos por módulos y gestiona progreso y certificados.</div>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:flex-wrap">
          <div className="w-full min-w-0 md:w-[420px]">
            <Select value={projectId || ""} onValueChange={(v) => setProjectId(v)}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="Seleccionar empresa">{selectedProject?.name || null}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {props.projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.clientName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isStudentOnly ? (
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:w-auto md:flex-wrap">
              <Button
                type="button"
                variant={effectiveMode === "manage" ? "default" : "outline"}
                size="sm"
                className={
                  effectiveMode === "manage"
                    ? "w-full bg-slate-900 text-white hover:bg-slate-800 hover:text-white focus-visible:ring-slate-900/40"
                    : "w-full text-slate-900"
                }
                onClick={() => setMode("manage")}
              >
                <Settings className="mr-2 h-4 w-4" />
                <span className="sm:hidden">Admin</span>
                <span className="hidden sm:inline">Administrar</span>
              </Button>
              <Button
                type="button"
                variant={effectiveMode === "student" ? "default" : "outline"}
                size="sm"
                className={
                  effectiveMode === "student"
                    ? "w-full bg-slate-900 text-white hover:bg-slate-800 hover:text-white focus-visible:ring-slate-900/40"
                    : "w-full text-slate-900"
                }
                onClick={() => setMode("student")}
              >
                <span className="sm:hidden">Estudiante</span>
                <span className="hidden sm:inline">Ver como estudiante</span>
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {isStudentOnly && props.aiBanner ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {props.aiBanner.message}.
        </div>
      ) : null}

      {!projectId ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">No hay empresas disponibles para formación.</CardContent>
        </Card>
      ) : (
        <>
          {effectiveMode === "manage" ? (
            <div className="grid gap-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 break-words text-sm text-slate-600">
                  Empresa seleccionada:{" "}
                  <span className="font-semibold text-slate-900">{selectedProject?.name || projectLabel}</span>
                  {selectedProject?.clientName ? <span className="text-slate-700"> — {selectedProject.clientName}</span> : null}
                </div>
                <Button
                  type="button"
                  className="w-full bg-[#D4AF37] hover:bg-[#c49f2f] text-black gap-2 sm:w-auto"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Nuevo curso
                </Button>
              </div>

              <CourseCreateDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                projectId={projectId}
                onCreated={async () => {
                  await refreshCourses();
                  await refreshStudent();
                }}
              />
              {studentsCourse ? (
                <CourseStudentsDialog
                  open={studentsOpen}
                  onOpenChange={(v) => {
                    setStudentsOpen(v);
                    if (!v) setStudentsCourse(null);
                  }}
                  courseId={studentsCourse.id}
                  courseTitle={studentsCourse.title}
                  currentUserRole={props.currentUser.role}
                />
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {loadingCourses ? (
                  <Card>
                    <CardContent className="p-6 text-sm text-slate-600">Cargando…</CardContent>
                  </Card>
                ) : courses.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-sm text-slate-600">Aún no hay cursos.</CardContent>
                  </Card>
                ) : (
                  courses.map((c) => (
                    <Card key={c.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <CourseCover url={c.coverUrl} title={c.title} />
                        <div className="mt-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-slate-900">{c.title}</div>
                            {c.description ? <div className="mt-1 line-clamp-3 text-sm text-slate-600 break-words">{c.description}</div> : null}
                          </div>
                          <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{c.modules.length} módulos</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge className={c.exam ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
                            {c.exam ? "Con examen" : "Sin examen"}
                          </Badge>
                          <Badge className={c.certificateEnabled ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
                            {c.certificateEnabled ? "Certificado activo" : "Sin certificado"}
                          </Badge>
                        </div>
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => {
                              setStudentsCourse({ id: c.id, title: c.title });
                              setStudentsOpen(true);
                            }}
                          >
                            Asignar estudiantes
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-6">
              <div className="grid gap-2 lg:hidden">
                <div className="text-sm font-medium text-slate-900">Curso</div>
                {loadingCourses || loadingStudent ? (
                  <div className="text-sm text-slate-600">Cargando…</div>
                ) : courses.length === 0 ? (
                  <div className="text-sm text-slate-600">No hay cursos</div>
                ) : (
                  <Select value={selectedCourseId || courses[0]?.id || ""} onValueChange={(v) => setSelectedCourseId(v)}>
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue placeholder="Seleccionar curso" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="grid gap-4 lg:grid-cols-12">
                <Card className="hidden lg:block lg:col-span-3">
                  <CardHeader>
                    <CardTitle className="text-base">Cursos</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    {loadingCourses || loadingStudent ? (
                      <div className="text-sm text-slate-600">Cargando…</div>
                    ) : courses.length === 0 ? (
                      <div className="text-sm text-slate-600">No hay cursos</div>
                    ) : (
                      courses.map((c) => {
                        const completedSet = new Set(studentState.progress.map((p) => p.moduleId));
                        const doneCount = c.modules.filter((m) => completedSet.has(m.id)).length;
                        const p = percent(doneCount, c.modules.length);
                        const active = c.id === selectedCourseId;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedCourseId(c.id)}
                            className={cn(
                              "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                              active
                                ? "border-[#D4AF37]/70 bg-white shadow-sm ring-1 ring-[#D4AF37]/20"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    className={cn(
                                      "h-2 w-2 rounded-full",
                                      active ? "bg-[#D4AF37]" : "bg-slate-300"
                                    )}
                                  />
                                  <div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                                    {c.title}
                                  </div>
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                                  <span>{c.modules.length} módulos</span>
                                  <span>•</span>
                                  <span>{p}%</span>
                                </div>
                              </div>
                              {p === 100 ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <BookOpen className="h-4 w-4 text-slate-500" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </CardContent>
                </Card>

                <div className="lg:col-span-9">
                  {selectedCourse ? (
                    <StudentCourseView
                      course={selectedCourse}
                      currentUser={props.currentUser}
                      studentState={studentState}
                      onCompleted={handleCompleteModule}
                      onExamSubmitted={() => void onExamSubmitted()}
                    />
                  ) : (
                    <Card>
                      <CardContent className="p-6 text-sm text-slate-600">Selecciona un curso</CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
