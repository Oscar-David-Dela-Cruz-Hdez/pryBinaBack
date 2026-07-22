const Pedido = require('../models/Pedido');
const Producto = require('../models/Producto');

const id = valor => valor?._id?.toString?.() || valor?.toString?.() || '';

const calcularEdad = (fechaNacimiento, fechaReferencia = new Date()) => {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento);
  const referencia = new Date(fechaReferencia);
  let edad = referencia.getFullYear() - nacimiento.getFullYear();
  const antesDelCumple = referencia.getMonth() < nacimiento.getMonth() ||
    (referencia.getMonth() === nacimiento.getMonth() && referencia.getDate() < nacimiento.getDate());
  if (antesDelCumple) edad--;
  return Number.isFinite(edad) && edad >= 0 ? edad : null;
};

const similitudJaccard = (a, b) => {
  const conjuntoA = new Set((a.productos || []).map(item => id(item.producto)));
  const conjuntoB = new Set((b.productos || []).map(item => id(item.producto)));
  const interseccion = [...conjuntoA].filter(productoId => conjuntoB.has(productoId)).length;
  const union = new Set([...conjuntoA, ...conjuntoB]).size;
  return union ? interseccion / union : 0;
};

/**
 * Clasificador k-NN sencillo para la demostración académica.
 * Aprende únicamente de pedidos cuyo resultado ya se conoce y no persiste campos calculados.
 */
const estimarRiesgo = (pedido, historicos) => {
  const candidatos = historicos
    .filter(historico => id(historico._id) !== id(pedido._id))
    .map(historico => {
      const maxTotal = Math.max(Number(pedido.total) || 0, Number(historico.total) || 0, 1);
      const diferenciaTotal = Math.abs((Number(pedido.total) || 0) - (Number(historico.total) || 0)) / maxTotal;
      const diferenciaCantidad = Math.min(
        Math.abs((pedido.productos?.length || 0) - (historico.productos?.length || 0)) / 5,
        1
      );
      const coincidePago = pedido.metodoPago === historico.metodoPago ? 1 : 0;
      const similitudProductos = similitudJaccard(pedido, historico);
      const edadPedido = calcularEdad(pedido.usuario?.fechaNacimiento, pedido.createdAt);
      const edadHistorico = calcularEdad(historico.usuario?.fechaNacimiento, historico.createdAt);
      const similitudEdad = edadPedido === null || edadHistorico === null ? 0.5 : 1 - Math.min(Math.abs(edadPedido - edadHistorico) / 50, 1);
      const similitud = (coincidePago * 0.30) + ((1 - diferenciaTotal) * 0.25) +
        (similitudProductos * 0.20) + ((1 - diferenciaCantidad) * 0.10) + (similitudEdad * 0.15);
      return { historico, similitud };
    })
    .sort((a, b) => b.similitud - a.similitud)
    .slice(0, 25);

  const pesoTotal = candidatos.reduce((suma, vecino) => suma + vecino.similitud, 0);
  const pesoCancelados = candidatos.reduce(
    (suma, vecino) => suma + (vecino.historico.estado === 'Cancelado' ? vecino.similitud : 0), 0
  );
  const probabilidad = pesoTotal ? pesoCancelados / pesoTotal : 0.25;
  const porcentaje = Math.round(Math.max(0.02, Math.min(0.98, probabilidad)) * 100);
  const mismoMetodo = historicos.filter(item => item.metodoPago === pedido.metodoPago);
  const canceladosMismoMetodo = mismoMetodo.filter(item => item.estado === 'Cancelado').length;
  const tasaMetodo = mismoMetodo.length ? Math.round((canceladosMismoMetodo / mismoMetodo.length) * 100) : 0;
  const edad = calcularEdad(pedido.usuario?.fechaNacimiento, pedido.createdAt);
  return {
    porcentaje,
    nivel: porcentaje >= 60 ? 'Alto' : porcentaje >= 35 ? 'Medio' : 'Bajo',
    vecinosUsados: candidatos.length,
    factores: [
      `Método ${pedido.metodoPago}: ${tasaMetodo}% de cancelación histórica`,
      `Total del pedido: $${Number(pedido.total || 0).toLocaleString('es-MX')}`,
      `${pedido.productos?.length || 0} productos distintos en el pedido`,
      edad === null ? 'Edad no disponible' : `Edad del cliente al realizar el pedido: ${edad} años`,
      `Comparado con ${candidatos.length} pedidos similares`
    ]
  };
};

const obtenerRiesgosCancelacion = async () => {
  const [historicos, pendientes, totalHistoricos, totalCancelados] = await Promise.all([
    Pedido.find({ estado: { $in: ['Entregado', 'Cancelado'] } })
      .select('_id usuario productos total metodoPago estado createdAt').populate('usuario', 'fechaNacimiento').sort({ createdAt: -1 }).limit(2500).lean(),
    Pedido.find({ estado: { $in: ['Pendiente', 'Pagado'] } })
      .populate('usuario', 'nombre email fechaNacimiento').sort({ createdAt: -1 }).limit(200).lean(),
    Pedido.countDocuments({ estado: { $in: ['Entregado', 'Cancelado'] } }),
    Pedido.countDocuments({ estado: 'Cancelado' })
  ]);
  // Solamente los pedidos cuyo resultado todavía no se conoce requieren predicción.
  // Antes se recalculaban también los 1,800 históricos, provocando millones de comparaciones.
  const resultados = pendientes.map(pedido => ({
    pedidoId: id(pedido._id),
    usuario: pedido.usuario,
    estado: pedido.estado,
    total: pedido.total,
    metodoPago: pedido.metodoPago,
    createdAt: pedido.createdAt,
    riesgo: estimarRiesgo(pedido, historicos)
  }));
  return {
    modelo: 'k-NN sobre pedidos históricos',
    entrenamiento: { pedidos: totalHistoricos, cancelados: totalCancelados },
    resumen: {
      analizados: resultados.length,
      riesgoAlto: resultados.filter(item => item.riesgo.nivel === 'Alto').length,
      riesgoMedio: resultados.filter(item => item.riesgo.nivel === 'Medio').length,
      riesgoBajo: resultados.filter(item => item.riesgo.nivel === 'Bajo').length
    },
    predicciones: resultados
  };
};

/** Filtrado colaborativo item-item con similitud coseno de coocurrencias. */
const recomendarProductos = async (productoIds, limite = 6) => {
  const semillas = [...new Set((productoIds || []).map(String).filter(Boolean))];
  if (!semillas.length) return [];
  const pedidos = await Pedido.find({ estado: 'Entregado' }).select('productos.producto').lean();
  const frecuencia = new Map();
  const coocurrencia = new Map();
  for (const pedido of pedidos) {
    const productos = [...new Set((pedido.productos || []).map(item => id(item.producto)).filter(Boolean))];
    productos.forEach(productoId => frecuencia.set(productoId, (frecuencia.get(productoId) || 0) + 1));
    for (let i = 0; i < productos.length; i++) {
      for (let j = i + 1; j < productos.length; j++) {
        const clave = [productos[i], productos[j]].sort().join('|');
        coocurrencia.set(clave, (coocurrencia.get(clave) || 0) + 1);
      }
    }
  }
  const puntuaciones = new Map();
  for (const semilla of semillas) {
    for (const [candidato, frecuenciaCandidato] of frecuencia.entries()) {
      if (semillas.includes(candidato)) continue;
      const juntos = coocurrencia.get([semilla, candidato].sort().join('|')) || 0;
      if (!juntos) continue;
      const similitud = juntos / Math.sqrt((frecuencia.get(semilla) || 1) * frecuenciaCandidato);
      // Suma evidencia de todas las semillas del carrito; así una cesta variada
      // no queda representada únicamente por el producto más popular.
      puntuaciones.set(candidato, (puntuaciones.get(candidato) || 0) + similitud);
    }
  }
  const idsOrdenados = [...puntuaciones.entries()].sort((a, b) => b[1] - a[1]).slice(0, limite * 2);
  let productos = await Producto.find({ _id: { $in: idsOrdenados.map(([productoId]) => productoId) }, activo: true, stock: { $gt: 0 } })
    .populate('marca', 'nombre').populate('familia', 'nombre').lean();
  productos.sort((a, b) => (puntuaciones.get(id(b._id)) || 0) - (puntuaciones.get(id(a._id)) || 0));

  // Con poco historial, completa por familia/marca de las distintas semillas,
  // distribuyendo candidatos para conservar diversidad en carritos mixtos.
  if (productos.length < limite) {
    const excluir = [...semillas, ...productos.map(producto => id(producto._id))];
    const productosSemilla = await Producto.find({ _id: { $in: semillas } }).select('marca familia').lean();
    const familias = productosSemilla.map(p => p.familia).filter(Boolean);
    const marcas = productosSemilla.map(p => p.marca).filter(Boolean);
    const relacionados = await Producto.find({
      _id: { $nin: excluir }, activo: true, stock: { $gt: 0 },
      $or: [{ familia: { $in: familias } }, { marca: { $in: marcas } }]
    }).populate('marca', 'nombre').populate('familia', 'nombre').limit(limite - productos.length).lean();
    productos = productos.concat(relacionados);
    if (productos.length < limite) {
      const excluirFinal = [...excluir, ...productos.map(producto => id(producto._id))];
      const respaldo = await Producto.find({ _id: { $nin: excluirFinal }, activo: true, stock: { $gt: 0 } })
        .populate('marca', 'nombre').populate('familia', 'nombre').limit(limite - productos.length).lean();
      productos = productos.concat(respaldo);
    }
  }
  return productos.slice(0, limite).map(producto => ({
    ...producto,
    similitud: Number((puntuaciones.get(id(producto._id)) || 0).toFixed(3)),
    motivo: puntuaciones.has(id(producto._id)) ? 'Comprado junto con este producto' : 'Producto disponible del catálogo'
  }));
};

module.exports = { obtenerRiesgosCancelacion, recomendarProductos };
