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
    </div>
  );
}
