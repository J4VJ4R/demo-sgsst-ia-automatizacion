import QRCode from "qrcode";

export const runtime = "nodejs";

const LOGIN_URL = "https://app.pmdservicios.com/login";

export async function GET() {
  const png = await QRCode.toBuffer(LOGIN_URL, {
    type: "png",
    width: 768,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  const body = new Uint8Array(png.buffer, png.byteOffset, png.byteLength);

  return new Response(body as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "content-disposition": 'inline; filename="pmd-login-qr.png"',
      "cache-control": "public, max-age=86400",
    },
  });
}
