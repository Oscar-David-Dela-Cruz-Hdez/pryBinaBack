const Pedido = require('../models/Pedido');
const Producto = require('../models/Producto');
const {
  entrenarRandomForest,
  predecirRandomForest
} = require('./randomForestCancelacionService');

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

const valoresPorProducto = (pedido, campo) => {
  const valores = new Map();
  for (const item of pedido.productos || []) {
    const productoId = id(item.producto);
    if (!productoId) continue;
    const valor = Number(item[campo]) || 0;
    valores.set(productoId, campo === 'cantidad' ? (valores.get(productoId) || 0) + valor : valor);
  }
  return valores;
};

// Compara cantidad o precio respetando cada producto del arreglo; no crea
// promedios ni campos nuevos en MongoDB.
const similitudCampoProductos = (a, b, campo) => {
  const valoresA = valoresPorProducto(a, campo);
  const valoresB = valoresPorProducto(b, campo);
  const productos = new Set([...valoresA.keys(), ...valoresB.keys()]);
  if (!productos.size) return 0;

  let suma = 0;
  for (const productoId of productos) {
    if (!valoresA.has(productoId) || !valoresB.has(productoId)) continue;
    const valorA = valoresA.get(productoId);
    const valorB = valoresB.get(productoId);
    suma += 1 - Math.min(Math.abs(valorA - valorB) / Math.max(valorA, valorB, 1), 1);
  }
  return suma / productos.size;
};

// Calcula la tasa previa de cada pedido en orden cronológico para evitar
// que su propio resultado o pedidos futuros se filtren hacia la predicción.
const construirHistorialUsuarios = (historicos) => {
  const acumulado = new Map();
  const tasaPreviaPorPedido = new Map();
  const ordenados = [...historicos].sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  );

  for (const pedido of ordenados) {
    const usuarioId = id(pedido.usuario);
    const previo = acumulado.get(usuarioId) || { total: 0, cancelados: 0 };
    tasaPreviaPorPedido.set(id(pedido._id), previo.total ? previo.cancelados / previo.total : 0);
    acumulado.set(usuarioId, {
      total: previo.total + 1,
      cancelados: previo.cancelados + (pedido.estado === 'Cancelado' ? 1 : 0)
    });
  }

  return { tasaPreviaPorPedido, acumuladoPorUsuario: acumulado };
};

/**
 * Clasificador k-NN sencillo para la demostración académica.
 * Aprende únicamente de pedidos cuyo resultado ya se conoce y no persiste campos calculados.
 */
const estimarRiesgo = (pedido, historicos, contextoHistorial) => {
  const historialPedido = contextoHistorial.acumuladoPorUsuario.get(id(pedido.usuario)) || { total: 0, cancelados: 0 };
  const tasaCancelacionPedido = historialPedido.total
    ? historialPedido.cancelados / historialPedido.total
    : 0;

  const candidatos = historicos
    .filter(historico => id(historico._id) !== id(pedido._id))
    .map(historico => {
      const maxTotal = Math.max(Number(pedido.total) || 0, Number(historico.total) || 0, 1);
      const diferenciaTotal = Math.abs((Number(pedido.total) || 0) - (Number(historico.total) || 0)) / maxTotal;
      const coincidePago = pedido.metodoPago === historico.metodoPago ? 1 : 0;
      const similitudProductos = similitudJaccard(pedido, historico);
      const similitudCantidad = similitudCampoProductos(pedido, historico, 'cantidad');
      const similitudPrecio = similitudCampoProductos(pedido, historico, 'precio');
      const maxEnvio = Math.max(Number(pedido.costoEnvio) || 0, Number(historico.costoEnvio) || 0, 1);
      const similitudEnvio = 1 - Math.min(
        Math.abs((Number(pedido.costoEnvio) || 0) - (Number(historico.costoEnvio) || 0)) / maxEnvio,
        1
      );
      const edadPedido = calcularEdad(pedido.usuario?.fechaNacimiento, pedido.createdAt);
      const edadHistorico = calcularEdad(historico.usuario?.fechaNacimiento, historico.createdAt);
      const similitudEdad = edadPedido === null || edadHistorico === null ? 0.5 : 1 - Math.min(Math.abs(edadPedido - edadHistorico) / 50, 1);
      const tasaCancelacionHistorico = contextoHistorial.tasaPreviaPorPedido.get(id(historico._id)) || 0;
      const similitudHistorial = 1 - Math.abs(tasaCancelacionPedido - tasaCancelacionHistorico);
      const similitud = (coincidePago * 0.15) + ((1 - diferenciaTotal) * 0.10) +
        (similitudProductos * 0.15) + (similitudCantidad * 0.10) +
        (similitudPrecio * 0.10) + (similitudEnvio * 0.10) +
        (similitudEdad * 0.10) + (similitudHistorial * 0.20);
      return { historico, similitud };
    })
    .sort((a, b) => b.similitud - a.similitud)
    .slice(0, 25);

  const pesoTotal = candidatos.reduce((suma, vecino) => suma + vecino.similitud, 0);
  const pesoCancelados = candidatos.reduce(
    (suma, vecino) => suma + (vecino.historico.estado === 'Cancelado' ? vecino.similitud : 0), 0
  );
  const probabilidadVecinos = pesoTotal ? pesoCancelados / pesoTotal : 0.25;
  // El historial personal aporta 20% cuando existe; el 80% restante proviene
  // de los vecinos. Sin historial personal se conserva completamente el k-NN.
  const probabilidad = historialPedido.total
    ? (probabilidadVecinos * 0.80) + (tasaCancelacionPedido * 0.20)
    : probabilidadVecinos;
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
      `Costo de envío: $${Number(pedido.costoEnvio || 0).toLocaleString('es-MX')}`,
      `${pedido.productos?.length || 0} productos; se compararon sus cantidades y precios`,
      `Historial personal: ${historialPedido.cancelados} de ${historialPedido.total} pedidos cancelados (${Math.round(tasaCancelacionPedido * 100)}%)`,
      edad === null ? 'Edad no disponible' : `Edad del cliente al realizar el pedido: ${edad} años`,
      `Comparado con ${candidatos.length} pedidos similares`
    ]
  };
};

const obtenerRiesgosCancelacionKnnAnterior = async () => {
  const [historicos, pendientes, totalHistoricos, totalCancelados] = await Promise.all([
    Pedido.find({ estado: { $in: ['Entregado', 'Cancelado'] } })
      .select('_id usuario productos total costoEnvio metodoPago estado createdAt').populate('usuario', 'fechaNacimiento').sort({ createdAt: -1 }).limit(2500).lean(),
    Pedido.find({ estado: { $in: ['Pendiente', 'Pagado'] } })
      .populate('usuario', 'nombre email fechaNacimiento').sort({ createdAt: -1 }).limit(200).lean(),
    Pedido.countDocuments({ estado: { $in: ['Entregado', 'Cancelado'] } }),
    Pedido.countDocuments({ estado: 'Cancelado' })
  ]);
  const contextoHistorial = construirHistorialUsuarios(historicos);
  // Solamente los pedidos cuyo resultado todavía no se conoce requieren predicción.
  // Antes se recalculaban también los 1,800 históricos, provocando millones de comparaciones.
  const resultados = pendientes.map(pedido => ({
    pedidoId: id(pedido._id),
    usuario: pedido.usuario,
    estado: pedido.estado,
    total: pedido.total,
    metodoPago: pedido.metodoPago,
    createdAt: pedido.createdAt,
    riesgo: estimarRiesgo(pedido, historicos, contextoHistorial)
  }));
  return {
    modelo: 'k-NN ponderado con 8 variables del dataset',
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

let cacheBosque = { firma: null, modelo: null };

const construirFirmaHistorial = (historicos) => {
  const ultimoCambio = historicos.reduce((maximo, pedido) => {
    const marcaTiempo = new Date(pedido.updatedAt || pedido.createdAt || 0).getTime();
    return Math.max(maximo, Number.isFinite(marcaTiempo) ? marcaTiempo : 0);
  }, 0);
  const cancelados = historicos.filter(pedido => pedido.estado === 'Cancelado').length;
  return `${historicos.length}:${cancelados}:${ultimoCambio}`;
};

const obtenerBosqueEntrenado = (historicos) => {
  const firma = construirFirmaHistorial(historicos);
  if (!cacheBosque.modelo || cacheBosque.firma !== firma) {
    cacheBosque = { firma, modelo: entrenarRandomForest(historicos) };
  }
  return cacheBosque.modelo;
};

const obtenerRiesgosCancelacion = async () => {
  const [historicos, pendientes] = await Promise.all([
    Pedido.find({ estado: { $in: ['Entregado', 'Cancelado'] } })
      .select('_id usuario productos total costoEnvio metodoPago estado createdAt updatedAt')
      .populate('usuario', 'fechaNacimiento')
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean(),
    Pedido.find({ estado: 'Pendiente' })
      .populate('usuario', 'nombre email fechaNacimiento')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
  ]);

  const totalCancelados = historicos.filter(pedido => pedido.estado === 'Cancelado').length;
  const modelo = historicos.length ? obtenerBosqueEntrenado(historicos) : null;
  const resultados = modelo
    ? pendientes.map(pedido => {
      const prediccion = predecirRandomForest(modelo, pedido);
      const porcentaje = Math.round(Math.max(0.02, Math.min(0.98, prediccion.probabilidad)) * 100);
      return {
        pedidoId: id(pedido._id),
        usuario: pedido.usuario,
        estado: pedido.estado,
        total: pedido.total,
        metodoPago: pedido.metodoPago,
        createdAt: pedido.createdAt,
        riesgo: {
          porcentaje,
          nivel: porcentaje >= 60 ? 'Alto' : porcentaje >= 35 ? 'Medio' : 'Bajo',
          arbolesUsados: prediccion.arbolesUsados,
          factores: [
            `Edad: ${calcularEdad(pedido.usuario?.fechaNacimiento, pedido.createdAt) ?? 'no disponible'}`,
            `Metodo de pago: ${pedido.metodoPago || 'no disponible'}`,
            `Total: $${Number(pedido.total || 0).toLocaleString('es-MX')}`,
            `Costo de envio: $${Number(pedido.costoEnvio || 0).toLocaleString('es-MX')}`,
            `${pedido.productos?.length || 0} productos; se usaron sus cantidades y precios`,
            `Cancelaciones previas del cliente: ${Math.round(prediccion.tasaCancelacionPrevia * 100)}%`
          ]
        }
      };
    })
    : [];

  return {
    modelo: modelo
      ? `Random Forest · ${modelo.arboles.length} arboles · 8 variables`
      : 'Random Forest · sin historial suficiente',
    entrenamiento: { pedidos: historicos.length, cancelados: totalCancelados },
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
  const pedidos = await Pedido.find({ estado: 'Entregado' }).select('productos.producto').sort({ createdAt: -1 }).limit(1000).lean();
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
