const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { allowedOrigins, configureHttpSecurity, apiNotFound, apiErrorHandler } = require("../middlewares/httpSecurity");

let server;
let base;
before(async () => {
  const app = express();
  configureHttpSecurity(app, { CORS_ALLOWED_ORIGINS: "https://web.example.test,http://localhost:4200" });
  // Models the raw webhook: middleware must not consume its request body.
  app.post("/api/alexa", express.raw({ type: "application/json" }), (req, res) => res.json({ raw: Buffer.isBuffer(req.body) }));
  app.use(express.json({ limit: "1kb" }));
  app.get("/api/productos", (_req, res) => res.json([{ nombre: "Producto sintético" }]));
  app.get("/api/usuarios/perfil", (req, res) => req.get("Authorization") === "synthetic-token"
    ? res.json({ nombre: "Cliente sintético" }) : res.status(401).json({ error: "No autenticado" }));
  app.post("/api/datos", (req, res) => res.json(req.body));
  app.get("/api/fallo", () => { throw new Error("private-internal-detail"); });
  app.get("/api/recurso/:id", (req, res) => res.json({ id: req.params.id }));
  app.get("/api/pagos/paypal/retorno", (_req, res) => res.type("html").send("<!doctype html><title>Retorno</title>"));
  app.use("/api", apiNotFound);
  app.use(apiErrorHandler);
  server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });

async function request(path, options = {}) {
  return fetch(base + path, { ...options, headers: { "X-Forwarded-Proto": "https", ...options.headers } });
}
function securityHeaders(response) {
  assert.equal(response.headers.get("x-powered-by"), null);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000");
}
test("respuestas JSON exitosas y 401 mantienen cabeceras sin revelar Express", async () => {
  for (const path of ["/api/productos", "/api/usuarios/perfil"]) {
    const response = await request(path);
    securityHeaders(response);
    assert.match(response.headers.get("content-type"), /^application\/json/);
    assert.equal(response.status, path.endsWith("perfil") ? 401 : 200);
  }
});
test("origen autorizado recibe CORS exacto y preflight de Authorization", async () => {
  const origin = "https://web.example.test";
  const response = await request("/api/usuarios/perfil", { headers: { Origin: origin, Authorization: "synthetic-token" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.match(response.headers.get("vary"), /Origin/);
  const preflight = await request("/api/usuarios/perfil", { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" } });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get("access-control-allow-headers"), /Authorization/);
  securityHeaders(preflight);
});
test("rechaza dominios ajenos, null y suplantaciones por sufijo", async () => {
  for (const origin of ["https://evil.example", "null", "https://web.example.test.evil.example"]) {
    const response = await request("/api/productos", { headers: { Origin: origin } });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.deepEqual(await response.json(), { error: "Origen no autorizado" });
    securityHeaders(response);
  }
});
test("cliente móvil sin Origin conserva acceso y no obtiene wildcard CORS", async () => {
  const response = await request("/api/usuarios/perfil", { headers: { Authorization: "synthetic-token" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});
test("rutas inexistentes y métodos no soportados responden JSON 404", async () => {
  for (const [path, method] of [["/api/desconocida", "GET"], ["/api/usuarios/perfil", "POST"]]) {
    const response = await request(path, { method });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Ruta API no encontrada" });
    securityHeaders(response);
  }
});
test("JSON malformado, demasiado grande y URI inválida no generan HTML", async () => {
  for (const [path, body, status] of [["/api/datos", "{", 400], ["/api/datos", JSON.stringify({ text: "x".repeat(2000) }), 413], ["/api/recurso/%E0%A4%A", null, 400]]) {
    const response = await request(path, body === null ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body });
    assert.equal(response.status, status);
    assert.match(response.headers.get("content-type"), /^application\/json/);
    securityHeaders(response);
    assert.equal(typeof (await response.json()).error, "string");
  }
});
test("fallos internos son JSON 500 sin traza ni detalles privados", async () => {
  const response = await request("/api/fallo");
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Error interno del servidor" });
  securityHeaders(response);
});
test("el webhook conserva bytes originales y PayPal conserva HTML declarado", async () => {
  const webhook = await request("/api/alexa", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.deepEqual(await webhook.json(), { raw: true });
  const paypal = await request("/api/pagos/paypal/retorno");
  assert.match(paypal.headers.get("content-type"), /^text\/html/);
  securityHeaders(paypal);
});
test("configuración vacía deniega CORS y no permite comodines o URLs con rutas", () => {
  assert.equal(allowedOrigins().size, 0);
  for (const origin of ["*", "null", "https://*.example.test", "https://web.example.test/ruta", "https://web.example.test/", "ftp://example.test"]) {
    assert.throws(() => allowedOrigins(origin));
  }
});
