const Pedido = require("../models/Pedido");
const Producto = require("../models/Producto");

const cancelarPedidoPendiente = async (pedidoId, motivo, usuarioId) => {
  const filtro = {
    _id: pedidoId,
    estado: "Pendiente",
    "pago.estado": "pendiente"
  };
  if (usuarioId) filtro.usuario = usuarioId;

  // El filtro por estado hace idempotente la devolución: solo una llamada puede cancelar.
  const pedido = await Pedido.findOneAndUpdate(
    filtro,
    {
      $set: {
        estado: "Cancelado",
        "pago.estado": "cancelado",
        "pago.fechaCancelacion": new Date(),
        "pago.motivoCancelacion": motivo,
        inventarioReservado: false
      }
    },
    { new: false }
  );

  if (!pedido) return null;
  if (pedido.inventarioReservado) {
    await Producto.bulkWrite(pedido.productos.map(item => ({
      updateOne: {
        filter: { _id: item.producto },
        update: { $inc: { stock: item.cantidad } }
      }
    })));
  }
  return Pedido.findById(pedidoId);
};

const cancelarPedidosVencidos = async () => {
  const vencidos = await Pedido.find({
    estado: "Pendiente",
    "pago.estado": "pendiente",
    $or: [
      { "pago.expiraEn": { $lte: new Date() } },
      {
        "pago.expiraEn": { $exists: false },
        createdAt: { $lte: new Date(Date.now() - 60 * 60 * 1000) }
      }
    ]
  }).select("_id").lean();

  for (const pedido of vencidos) {
    await cancelarPedidoPendiente(pedido._id, "Tiempo de pago vencido");
  }
  return vencidos.length;
};

module.exports = { cancelarPedidoPendiente, cancelarPedidosVencidos };
