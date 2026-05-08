
export function getSupportTicketEmailTemplate(data: {
  name: string;
  email: string;
  priority: string;
  subject: string;
  message: string;
}) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket de Soporte - SG-SST-IA</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background-color: #f4f4f5;
      margin: 0;
      padding: 0;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #0f172a;
      padding: 30px;
      text-align: center;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #ffffff;
      text-decoration: none;
    }
    .logo span {
      color: #38bdf8;
    }
    .content {
      padding: 40px 30px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-high { background-color: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; }
    .badge-medium { background-color: #fffbeb; color: #f59e0b; border: 1px solid #fef3c7; }
    .badge-low { background-color: #f0fdf4; color: #22c55e; border: 1px solid #dcfce7; }
    .badge-critical { background-color: #7f1d1d; color: #ffffff; border: 1px solid #991b1b; }
    
    h1 {
      margin-top: 0;
      font-size: 22px;
      color: #111827;
      margin-bottom: 20px;
    }
    .field {
      margin-bottom: 16px;
    }
    .label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 4px;
      display: block;
    }
    .value {
      font-size: 16px;
      color: #111827;
    }
    .message-box {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 20px;
      margin-top: 24px;
      white-space: pre-wrap;
      line-height: 1.6;
    }
    .footer {
      background-color: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">SG-SST-IA <span>Soporte</span></div>
    </div>
    <div class="content">
      <h1>Nuevo Ticket de Soporte</h1>
      
      <div className="field">
        <span class="label">Prioridad</span>
        <div class="value">
          <span class="badge ${
            data.priority === 'Alta' ? 'badge-high' :
            data.priority === 'Crítica' || data.priority === 'Critica' ? 'badge-critical' :
            data.priority === 'Media' ? 'badge-medium' : 'badge-low'
          }">${data.priority}</span>
        </div>
      </div>

      <div class="field">
        <span class="label">Solicitante</span>
        <div class="value">${data.name}</div>
        <div style="font-size: 14px; color: #6b7280;">${data.email}</div>
      </div>

      <div class="field">
        <span class="label">Asunto</span>
        <div class="value" style="font-weight: 500;">${data.subject}</div>
      </div>

      <div class="message-box">
        <span class="label">Mensaje:</span>
        <br/>
        ${data.message}
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} SG-SST-IA. Todos los derechos reservados.<br>
      Este es un correo automático generado por el sistema de soporte.
    </div>
  </div>
</body>
</html>
  `;
}
