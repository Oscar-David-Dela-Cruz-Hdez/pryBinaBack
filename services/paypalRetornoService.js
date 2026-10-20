// Angular conserva su flujo SDK. Flutter móvil intercepta las rutas de la API;
// Flutter web retorna a un archivo estático de su propio sitio, sin cargar Render.
const retornoFlutter = (req) => {
  if (req.body?.canal !== "flutter") return undefined;
  if (!req.body.returnUrl) {
    const base = (process.env.PUBLIC_API_URL || "https://prybinaback.onrender.com").replace(/\/$/, "");
    return { returnUrl: `${base}/api/pagos/paypal/retorno`, cancelUrl: `${base}/api/pagos/paypal/cancelado` };
  }
  const invalid = () => {
    throw Object.assign(new Error("Origen de retorno PayPal no permitido. Configura PAYPAL_FLUTTER_ORIGINS en el servidor."), { status: 400 });
  };
  let url;
  try { url = new URL(req.body.returnUrl); } catch { return invalid(); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const allowed = (process.env.PAYPAL_FLUTTER_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
  if ((!local && (!allowed.includes(url.origin) || url.protocol !== "https:")) ||
      (local && !["http:", "https:"].includes(url.protocol)) ||
      url.username || url.password || url.hash ||
      !url.pathname.endsWith("/paypal_return.html") ||
      !/^[a-zA-Z0-9-]{20,100}$/.test(url.searchParams.get("state") || "")) return invalid();
  // Conserva únicamente el estado generado por la ventana, no parámetros arbitrarios.
  const state = url.searchParams.get("state");
  url.search = "";
  url.searchParams.set("state", state);
  const returnUrl = url.href;
  url.searchParams.set("cancelled", "1");
  return { returnUrl, cancelUrl: url.href };
};
module.exports = { retornoFlutter };
