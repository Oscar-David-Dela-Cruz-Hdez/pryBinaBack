const axios = require("axios");

const getBaseUrl = () => process.env.PAYPAL_MODE === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

const validarConfiguracion = () => {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    const error = new Error("PayPal no está configurado en el servidor");
    error.status = 503;
    throw error;
  }
};

const obtenerAccessToken = async () => {
  validarConfiguracion();
  const credenciales = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const { data } = await axios.post(
    `${getBaseUrl()}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      timeout: 15000,
      headers: {
        Authorization: `Basic ${credenciales}`,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );
  return data.access_token;
};

const paypalRequest = async (method, path, body) => {
  const token = await obtenerAccessToken();
  const response = await axios({
    method,
    url: `${getBaseUrl()}${path}`,
    data: body,
    timeout: 20000,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    }
  });
  return response.data;
};

const crearOrden = (pedido) => paypalRequest("post", "/v2/checkout/orders", {
  intent: "CAPTURE",
  purchase_units: [{
    reference_id: pedido._id.toString(),
    custom_id: pedido._id.toString(),
    description: `Pedido Panamericana ${pedido._id}`,
    amount: {
      currency_code: "MXN",
      value: Number(pedido.total).toFixed(2)
    }
  }]
});

const capturarOrden = (orderId) => paypalRequest(
  "post",
  `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
  {}
);

module.exports = { crearOrden, capturarOrden };
