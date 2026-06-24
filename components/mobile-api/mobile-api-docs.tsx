'use client'

const loginExample = `POST /api/mobile/auth/login
Content-Type: application/json

{
  "email": "admin@autoavanzada.com",
  "password": "demo2026"
}`;

const bearerExample = `Authorization: Bearer TU_TOKEN`;

const loginResponseExample = `{
  "success": true,
  "token": "ey-demo-token",
  "tokenType": "Bearer",
  "expiresIn": 604800,
  "user": {
    "id": "uuid",
    "email": "admin@autoavanzada.com",
    "name": "Coordinador SIG",
    "role": "ADMIN_PMD",
    "image": null
  }
}`;

const envExample = `MOBILE_API_SECRET=pon_un_secreto_largo_y_unico

# Alternativa valida si ya existe
APP_ENCRYPTION_KEY=pon_un_secreto_largo_y_unico`;

const curlExample = `curl -X POST "https://tu-dominio.vercel.app/api/mobile/auth/login" ^
  -H "Content-Type: application/json" ^
  -d "{\\"email\\":\\"admin@autoavanzada.com\\",\\"password\\":\\"demo2026\\"}"`;

const postmanLoginExample = `POST {{baseUrl}}/api/mobile/auth/login
Content-Type: application/json

{
  "email": "admin@autoavanzada.com",
  "password": "demo2026"
}`;

const postmanProjectDetailExample = `GET {{baseUrl}}/api/mobile/projects/{{projectId}}
Authorization: Bearer {{token}}`;

const postmanReplyExample = `POST {{baseUrl}}/api/mobile/activities/{{activityId}}/reply
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "replyMessage": "Se adjunta nueva evidencia para revision.",
  "dueDate": "2026-05-30",
  "files": [
    {
      "originalName": "evidencia-ajustada.pdf",
      "key": "activities/{{activityId}}/archivo-generado.pdf",
      "fileSize": 245760
    }
  ]
}`;

const postmanAiOverviewExample = `GET {{baseUrl}}/api/mobile/overview
Authorization: Bearer {{token}}`;

const uploadFlowExample = `1. POST /api/mobile/activities/{activityId}/upload-request
2. Flutter sube el archivo a uploadUrl
3. POST /api/mobile/activities/{activityId}/reply

{
  "replyMessage": "Se ajusta evidencia y se responde devolucion.",
  "dueDate": "2026-05-30",
  "files": [
    {
      "originalName": "evidencia-riesgo-electrico.pdf",
      "key": "activities/{activityId}/archivo-generado.pdf",
      "fileSize": 245760
    }
  ]
}`;

const aiResponseExample = `{
  "success": true,
  "summary": {
    "projects": 4,
    "collaborators": 126,
    "activities": {
      "total": 32,
      "pending": 7,
      "inReview": 6,
      "rejected": 4,
      "approved": 15
    }
  },
  "predictiveInsights": {
    "totalInspections": 32,
    "highRiskCount": 5,
    "mediumRiskCount": 11,
    "lowRiskCount": 16,
    "highRiskProbability": 72,
    "topRiskZones": [
      {
        "label": "Subestacion principal",
        "riskScore": 84
      }
    ],
    "alerts": [
      {
        "title": "Probabilidad elevada de incidente electrico",
        "message": "Se detectan hallazgos repetidos en inspecciones recientes."
      }
    ],
    "recommendations": [
      "Priorizar correccion de hallazgos electricos repetidos",
      "Programar capacitacion focalizada en riesgo electrico"
    ]
  }
}`;

const flutterServiceExample = `class MobileApiService {
  MobileApiService({
    required this.baseUrl,
    required this.tokenProvider,
  });

  final String baseUrl;
  final Future<String?> Function() tokenProvider;

  Future<Map<String, String>> _headers() async {
    final token = await tokenProvider();
    return {
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  Future<http.Response> login(String email, String password) {
    return http.post(
      Uri.parse('$baseUrl/api/mobile/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
  }

  Future<http.Response> getProjects() async {
    return http.get(
      Uri.parse('$baseUrl/api/mobile/projects'),
      headers: await _headers(),
    );
  }

  Future<http.Response> getActivityDetail(String activityId) async {
    return http.get(
      Uri.parse('$baseUrl/api/mobile/activities/$activityId'),
      headers: await _headers(),
    );
  }
}`;

const flutterAiExample = `Future<http.Response> getAiOverview() async {
  return http.get(
    Uri.parse('$baseUrl/api/mobile/overview'),
    headers: await _headers(),
  );
}

// Idea de demo en pantalla:
// - Card 1: Probabilidad de riesgo alto
// - Card 2: Zonas mas criticas
// - Card 3: Alertas IA
// - Card 4: Recomendaciones accionables`;

const endpoints = [
  {
    method: "POST",
    path: "/api/mobile/auth/login",
    description: "Login movil. Devuelve Bearer token y usuario autenticado.",
  },
  {
    method: "GET",
    path: "/api/mobile/auth/me",
    description: "Retorna el usuario actual usando Authorization: Bearer.",
  },
  {
    method: "POST",
    path: "/api/mobile/auth/logout",
    description: "Logout demo. El cliente movil elimina el token localmente.",
  },
  {
    method: "GET",
    path: "/api/mobile/overview",
    description: "Resumen general y bloque de insights predictivos para dashboard movil.",
  },
  {
    method: "GET",
    path: "/api/mobile/projects",
    description: "Lista empresas visibles segun el rol autenticado.",
  },
  {
    method: "GET",
    path: "/api/mobile/activities?projectId={id}&status=PENDING&limit=20",
    description: "Lista actividades filtrables por empresa, estado y limite.",
  },
  {
    method: "GET",
    path: "/api/mobile/notifications?unreadOnly=true&limit=20",
    description: "Lista notificaciones del usuario autenticado.",
  },
  {
    method: "GET",
    path: "/api/mobile/projects/{projectId}",
    description: "Detalle de empresa con secciones, resumen y actividades recientes.",
  },
  {
    method: "GET",
    path: "/api/mobile/activities/{activityId}",
    description: "Detalle completo de actividad con documentos, replies e historial.",
  },
  {
    method: "POST",
    path: "/api/mobile/notifications/{notificationId}/read",
    description: "Marca una notificacion como leida desde la app movil.",
  },
  {
    method: "POST",
    path: "/api/mobile/activities/{activityId}/upload-request",
    description: "Genera URL firmada para subir evidencia desde Flutter a S3.",
  },
  {
    method: "POST",
    path: "/api/mobile/activities/{activityId}/reply",
    description: "Registra respuesta del consultor con mensaje y archivos ya subidos.",
  },
];

function MethodBadge({ method }: { method: string }) {
  const styles =
    method === "GET"
      ? "bg-sky-100 text-sky-700"
      : "bg-emerald-100 text-emerald-700";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>{method}</span>;
}

export function MobileApiDocs() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-8 text-white shadow-xl">
        <div className="max-w-4xl space-y-4">
          <div className="inline-flex rounded-full border border-sky-400/50 bg-sky-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">
            API movil demo
          </div>
          <h1 className="text-3xl font-bold md:text-4xl">Documentacion online para Flutter iOS y Android</h1>
          <p className="max-w-3xl text-sm text-slate-200 md:text-base">
            Esta capa demo permite avanzar la integracion movil con autenticacion Bearer y endpoints JSON listos para consumir
            desde Flutter.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 text-lg font-semibold text-slate-900">Variables requeridas en produccion</div>
          <p className="mb-4 text-sm text-slate-600">
            Debes configurar al menos una de estas variables en Vercel para que funcione el login movil.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
            <code>{envExample}</code>
          </pre>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Recomendado: usar <span className="font-semibold">MOBILE_API_SECRET</span> como secreto dedicado para la API
            movil.
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 text-lg font-semibold text-slate-900">Flujo rapido de autenticacion</div>
          <ol className="space-y-3 text-sm text-slate-700">
            <li>1. Flutter llama a <span className="font-semibold">POST /api/mobile/auth/login</span>.</li>
            <li>2. El backend devuelve <span className="font-semibold">token Bearer</span> y datos del usuario.</li>
            <li>3. Flutter guarda el token en almacenamiento seguro.</li>
            <li>4. Flutter envia el header <span className="font-semibold">Authorization: Bearer TU_TOKEN</span>.</li>
            <li>5. Flutter consulta overview, projects, activities y notifications.</li>
          </ol>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
            <code>{bearerExample}</code>
          </pre>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 text-lg font-semibold text-slate-900">Endpoints disponibles</div>
        <div className="grid gap-4">
          {endpoints.map((endpoint) => (
            <div key={endpoint.path} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <MethodBadge method={endpoint.method} />
                    <code className="text-sm font-semibold text-slate-900">{endpoint.path}</code>
                  </div>
                  <div className="text-sm text-slate-600">{endpoint.description}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 text-lg font-semibold text-slate-900">Ejemplo de login</div>
          <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
            <code>{loginExample}</code>
          </pre>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 text-lg font-semibold text-slate-900">Respuesta esperada</div>
          <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
            <code>{loginResponseExample}</code>
          </pre>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 text-lg font-semibold text-slate-900">Prueba desde terminal</div>
          <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
            <code>{curlExample}</code>
          </pre>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 text-lg font-semibold text-slate-900">Notas para el equipo Flutter</div>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>- Usar almacenamiento seguro para el token.</li>
            <li>- Renovar sesion relogueando si el token expira.</li>
            <li>- Consumir todo en JSON; no depende de cookies web.</li>
            <li>- Esta API es demo y sirve para avanzar el app Android/iOS mientras se completa la capa final.</li>
          </ul>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 text-lg font-semibold text-slate-900">Postman: login</div>
          <p className="mb-4 text-sm text-slate-600">
            Guarda `baseUrl` como variable de coleccion y usa este request para obtener el token inicial.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
            <code>{postmanLoginExample}</code>
          </pre>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 text-lg font-semibold text-slate-900">Postman: detalle de empresa</div>
          <p className="mb-4 text-sm text-slate-600">
            Despues del login, guarda `token` y `projectId` como variables para consultar el detalle.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
            <code>{postmanProjectDetailExample}</code>
          </pre>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 text-lg font-semibold text-slate-900">Postman: reply con evidencia</div>
          <p className="mb-4 text-sm text-slate-600">
            Este request se usa despues de subir el archivo al `uploadUrl` recibido en `upload-request`.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
            <code>{postmanReplyExample}</code>
          </pre>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-3">
          <div className="mb-3 text-lg font-semibold text-slate-900">Postman: demo IA movil</div>
          <p className="mb-4 text-sm text-slate-600">
            Este request permite mostrar el bloque predictivo de IA en la app movil usando el endpoint `overview`.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
            <code>{postmanAiOverviewExample}</code>
          </pre>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-3 text-lg font-semibold text-slate-900">Guia rapida para Flutter</div>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <ul className="space-y-2 text-sm text-slate-700">
              <li>- Crear un servicio centralizado para login, proyectos, actividades y notificaciones.</li>
              <li>- Guardar el token en `flutter_secure_storage` o equivalente seguro.</li>
              <li>- Enviar `Authorization: Bearer token` en todas las rutas privadas.</li>
              <li>- Para evidencias, primero llamar `upload-request`, luego subir binario y al final registrar `reply`.</li>
              <li>- Mapear las respuestas JSON a modelos simples como `MobileUser`, `MobileProject` y `MobileActivity`.</li>
            </ul>
          </div>
          <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
            <code>{flutterServiceExample}</code>
          </pre>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-3 text-lg font-semibold text-slate-900">Demo IA para Flutter</div>
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Para la demo IA en mobile, el equipo Flutter puede consumir `GET /api/mobile/overview` y renderizar el
              bloque `predictiveInsights` como tarjetas, alertas y recomendaciones.
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              <li>- Mostrar `highRiskProbability` como KPI principal o medidor circular.</li>
              <li>- Mostrar `topRiskZones` como lista de zonas o sedes criticas.</li>
              <li>- Mostrar `alerts` en un carrusel o cards de atencion prioritaria.</li>
              <li>- Mostrar `recommendations` como acciones sugeridas por la IA demo.</li>
              <li>- Combinar estos datos con el resumen de actividades para un dashboard movil ejecutivo.</li>
            </ul>
            <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
              <code>{flutterAiExample}</code>
            </pre>
          </div>
          <div>
            <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Respuesta demo esperada</div>
            <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
              <code>{aiResponseExample}</code>
            </pre>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-3 text-lg font-semibold text-slate-900">Fase 2: flujo de respuesta con evidencias</div>
        <p className="mb-4 text-sm text-slate-600">
          Este flujo permite que Flutter atienda devoluciones: pide una URL firmada, sube el archivo y luego registra la
          respuesta final contra la actividad.
        </p>
        <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
          <code>{uploadFlowExample}</code>
        </pre>
      </section>
    </div>
  );
}
