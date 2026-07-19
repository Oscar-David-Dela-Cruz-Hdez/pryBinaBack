const Pedido = require("../models/Pedido");
const Producto = require("../models/Producto");
const { crearOrden, capturarOrden } = require("../services/paypalService");

const liberarInventario = async (productos) => {
  await Promise.all(productos.map(item =>
    Producto.findByIdAndUpdate(item.producto, { $inc: { stock: item.cantidad } })
  ));
};

const crearOrdenPaypal = async (req, res) => {
  const reservados = [];
  let pedido;
  try {
    const { productos, direccionEnvio } = req.body;
    if (!Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ error: "El carrito está vacío" });
    }

    const camposDireccion = ["calle", "ciudad", "estado", "cp", "telefono"];
    if (!direccionEnvio || camposDireccion.some(campo => !String(direccionEnvio[campo] || "").trim())) {
      return res.status(400).json({ error: "La dirección de envío está incompleta" });
    }

    let subtotal = 0;
    for (const item of productos) {
      const cantidad = Number(item.cantidad);
      if (!Number.isInteger(cantidad) || cantidad < 1) {
        throw Object.assign(new Error("Cantidad de producto inválida"), { status: 400 });
      }

      const producto = await Producto.findOneAndUpdate(
        { _id: item.producto, activo: true, stock: { $gte: cantidad } },
        { $inc: { stock: -cantidad } },
        { new: true }
      );
      if (!producto) {
        throw Object.assign(new Error("Producto inexistente, inactivo o sin stock suficiente"), { status: 409 });
      }

      reservados.push({
        producto: producto._id,
        nombre: producto.nombre,
        cantidad,
        precio: producto.precioNormal
      });
      subtotal += Number(producto.precioNormal) * cantidad;
    }

    // El envío se calcula en servidor. Por ahora la política configurada es envío sin costo.
    const costoEnvio = 0;
    pedido = await Pedido.create({
      usuario: req.user.id,
      productos: reservados,
      total: subtotal + costoEnvio,
      costoEnvio,
      direccionEnvio,
      metodoPago: "PayPal",
      inventarioReservado: true,
      pago: { proveedor: "paypal", estado: "pendiente", moneda: "MXN", monto: subtotal + costoEnvio }
    });

    const ordenPaypal = await crearOrden(pedido);
    pedido.pago.ordenExternaId = ordenPaypal.id;
    await pedido.save();

    return res.status(201).json({ orderId: ordenPaypal.id, pedidoId: pedido._id, total: pedido.total });
  } catch (error) {
    if (reservados.length) await liberarInventario(reservados);
    if (pedido) await Pedido.findByIdAndDelete(pedido._id);
    console.error("Error al crear pago PayPal:", error.response?.data || error.message);
    return res.status(error.status || error.response?.status || 500).json({
      error: error.message || "No fue posible iniciar el pago"
    });
  }
};

const capturarOrdenPaypal = async (req, res) => {
  try {
    const pedido = await Pedido.findOne({
      "pago.ordenExternaId": req.params.orderId,
      usuario: req.user.id
    });
    if (!pedido) return res.status(404).json({ error: "Pedido de PayPal no encontrado" });

    if (pedido.pago.estado === "aprobado") {
      return res.json({ mensaje: "El pago ya estaba confirmado", pedido });
    }

    const resultado = await capturarOrden(req.params.orderId);
    const captura = resultado.purchase_units?.[0]?.payments?.captures?.[0];
    const montoCoincide = captura?.amount?.currency_code === "MXN" &&
      Number(captura?.amount?.value) === Number(pedido.total);

    if (resultado.status !== "COMPLETED" || captura?.status !== "COMPLETED" || !montoCoincide) {
      return res.status(409).json({ error: "PayPal no confirmó el pago por el importe esperado" });
    }

    pedido.pago.estado = "aprobado";
    pedido.pago.capturaId = captura.id;
    pedido.pago.fechaPago = new Date();
    pedido.estado = "Pagado";
    pedido.inventarioReservado = false;
    await pedido.save();

    return res.json({ mensaje: "Pago confirmado", pedido });
  } catch (error) {
    console.error("Error al capturar pago PayPal:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({ error: "No fue posible confirmar el pago" });
  }
};

// Genera una orden PayPal nueva para un pedido pendiente ya existente.
// No crea otro pedido ni vuelve a modificar el inventario reservado.
const reintentarOrdenPaypal = async (req, res) => {
  try {
    const pedido = await Pedido.findOne({ _id: req.params.pedidoId, usuario: req.user.id });
    if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

    if (pedido.estado !== "Pendiente" || pedido.pago?.estado !== "pendiente") {
      return res.status(409).json({ error: "Este pedido ya no admite un nuevo intento de pago" });
    }
    if (pedido.pago?.proveedor !== "paypal") {
      return res.status(400).json({ error: "El pedido no utiliza PayPal" });
    }

    const ordenPaypal = await crearOrden(pedido);
    pedido.pago.ordenExternaId = ordenPaypal.id;
    await pedido.save();

    return res.status(201).json({ orderId: ordenPaypal.id, pedidoId: pedido._id, total: pedido.total });
  } catch (error) {
    console.error("Error al reintentar pago PayPal:", error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({ error: "No fue posible reiniciar el pago" });
  }
};

const obtenerConfiguracionPaypal = (req, res) => {
  if (!process.env.PAYPAL_CLIENT_ID) {
    return res.status(503).json({ error: "PayPal no está configurado" });
  }
  res.json({ clientId: process.env.PAYPAL_CLIENT_ID, currency: "MXN" });
};

module.exports = { crearOrdenPaypal, capturarOrdenPaypal, reintentarOrdenPaypal, obtenerConfiguracionPaypal };
