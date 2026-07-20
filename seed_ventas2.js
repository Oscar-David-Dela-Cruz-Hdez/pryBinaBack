/**
 * seed_ventas2.js
 * --------------------------------------------------------------------------
 * Genera datos sintéticos para dos casos de aprendizaje automático:
 *
 * 1. Clasificación de pedidos con riesgo de cancelación.
 * 2. Recomendación colaborativa basada en productos (item-item).
 *
 * Características de los datos:
 * - Crea pedidos Entregados y Cancelados con patrones probabilísticos.
 * - Reutiliza usuarios para que cada cliente tenga varias compras.
 * - Forma canastas de productos afines por familia o marca.
 * - No modifica el stock de productos.
 * - Marca todos los pedidos con direccionEnvio.calle = SINTETICO_ML_V2.
 *
 * Uso:
 *   node seed_ventas2.js
 *   node seed_ventas2.js --cantidad 2000
 *   node seed_ventas2.js --semilla 12345
 *   node seed_ventas2.js --ver
 *   node seed_ventas2.js --stats
 *   node seed_ventas2.js --limpiar
 *
 * IMPORTANTE: úsese preferentemente en una base de datos de desarrollo/prueba.
 * --------------------------------------------------------------------------
 */

require('dotenv').config();
const dns = require('dns');

dns.setServers([
  '1.1.1.1',
  '8.8.8.8'
]);
const mongoose = require('mongoose');

const Producto = require('./models/Producto');
const Usuario = require('./models/Usuario');
const Pedido = require('./models/Pedido');

const MARKER = 'SINTETICO_ML_V2';
const DEFAULT_TOTAL_PEDIDOS = 1500;
const DEFAULT_SEED = 20260720;

const METODOS_PAGO = ['Tarjeta', 'Transferencia', 'Efectivo'];
const DESTINOS = [
  { ciudad: 'Pachuca', estado: 'Hidalgo', cp: '42080', riesgo: 0.00 },
  { ciudad: 'Tulancingo', estado: 'Hidalgo', cp: '43600', riesgo: 0.02 },
  { ciudad: 'Puebla', estado: 'Puebla', cp: '72000', riesgo: 0.04 },
  { ciudad: 'Xalapa', estado: 'Veracruz', cp: '91000', riesgo: 0.06 },
  { ciudad: 'Querétaro', estado: 'Querétaro', cp: '76000', riesgo: 0.03 },
  { ciudad: 'Toluca', estado: 'Estado de México', cp: '50000', riesgo: 0.05 }
];

function obtenerArgumento(nombre, fallback) {
  const index = process.argv.indexOf(nombre);
  if (index === -1 || !process.argv[index + 1]) return fallback;
  return process.argv[index + 1];
}

function numeroEntero(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

// PRNG reproducible: la misma semilla produce la misma distribución lógica.
function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function crearUtilidadesAleatorias(seed) {
  const random = mulberry32(seed);
  const entero = (min, max) => Math.floor(random() * (max - min + 1)) + min;
  const elegir = (items) => items[entero(0, items.length - 1)];
  const mezclar = (items) => {
    const copia = [...items];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = entero(0, i);
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  };
  return { random, entero, elegir, mezclar };
}

function fechaAleatoria(random, diasAtras) {
  const ahora = new Date();
  const fecha = new Date(ahora);
  fecha.setDate(fecha.getDate() - Math.floor(random() * diasAtras));
  fecha.setHours(8 + Math.floor(random() * 15), Math.floor(random() * 60), Math.floor(random() * 60), 0);
  return fecha;
}

function claveGrupo(producto) {
  if (producto.familia) return `familia:${producto.familia.toString()}`;
  if (producto.marca) return `marca:${producto.marca.toString()}`;
  return 'catalogo:general';
}

function construirGrupos(productos) {
  const grupos = new Map();
  for (const producto of productos) {
    const clave = claveGrupo(producto);
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(producto);
  }

  // Los grupos de un solo producto no crean relaciones item-item útiles.
  // Se anexan al grupo general para que puedan aparecer con otros artículos.
  const general = [];
  for (const [clave, items] of grupos.entries()) {
    if (items.length < 2 && clave !== 'catalogo:general') {
      general.push(...items);
      grupos.delete(clave);
    }
  }
  if (general.length) {
    const existentes = grupos.get('catalogo:general') || [];
    grupos.set('catalogo:general', [...existentes, ...general]);
  }

  const resultado = [...grupos.values()].filter((grupo) => grupo.length >= 2);
  if (!resultado.length && productos.length >= 2) resultado.push(productos);
  return resultado;
}

function seleccionarSinRepetir(pool, cantidad, utils) {
  return utils.mezclar(pool).slice(0, Math.min(cantidad, pool.length));
}

function seleccionarProductosPedido(preferencias, todos, utils) {
  // La mayoría de pedidos contiene 2 o más productos para fortalecer
  // las relaciones de co-compra necesarias para la recomendación.
  const prob = utils.random();
  const cantidadObjetivo = prob < 0.12 ? 1 : prob < 0.50 ? 2 : prob < 0.82 ? 3 : 4;

  const grupoPreferido = utils.elegir(preferencias);
  const cantidadAfin = Math.max(1, cantidadObjetivo - (utils.random() < 0.22 ? 1 : 0));
  const seleccionados = seleccionarSinRepetir(grupoPreferido, cantidadAfin, utils);
  const ids = new Set(seleccionados.map((p) => p._id.toString()));

  if (seleccionados.length < cantidadObjetivo) {
    const candidatos = todos.filter((p) => !ids.has(p._id.toString()));
    seleccionados.push(...seleccionarSinRepetir(candidatos, cantidadObjetivo - seleccionados.length, utils));
  }

  return seleccionados;
}

function costoEnvioParaDestino(destino, utils) {
  const sinCosto = utils.random() < 0.28;
  if (sinCosto) return 0;
  const base = 55 + Math.floor(utils.random() * 111);
  return Math.round((base + destino.riesgo * 250) / 5) * 5;
}

function calcularProbabilidadCancelacion({ metodoPago, costoEnvio, total, destino, productos }) {
  let probabilidad = 0.10;

  if (metodoPago === 'Efectivo') probabilidad += 0.14;
  if (metodoPago === 'Transferencia') probabilidad += 0.06;
  if (costoEnvio >= 130) probabilidad += 0.10;
  if (total >= 2000) probabilidad += 0.09;
  if (productos.length >= 4) probabilidad += 0.05;
  probabilidad += destino.riesgo;

  // Evita reglas deterministas y limita el desbalance de clases.
  return Math.min(0.62, Math.max(0.08, probabilidad));
}

function crearPago({ cancelado, metodoPago, total, fechaPedido, utils }) {
  const proveedor = metodoPago === 'Tarjeta' ? 'paypal' : 'manual';
  if (cancelado) {
    const fechaCancelacion = new Date(fechaPedido);
    fechaCancelacion.setHours(fechaCancelacion.getHours() + utils.entero(1, 48));
    return {
      proveedor,
      estado: 'cancelado',
      moneda: 'MXN',
      monto: total,
      fechaCancelacion,
      motivoCancelacion: utils.elegir([
        'Cliente no confirmó la compra',
        'Pago no completado',
        'Cliente solicitó la cancelación',
        'Datos de entrega no confirmados'
      ])
    };
  }

  const fechaPago = new Date(fechaPedido);
  fechaPago.setMinutes(fechaPago.getMinutes() + utils.entero(2, 90));
  return {
    proveedor,
    estado: 'aprobado',
    moneda: 'MXN',
    monto: total,
    fechaPago
  };
}

async function crearPedidos() {
  const cantidad = numeroEntero(obtenerArgumento('--cantidad', DEFAULT_TOTAL_PEDIDOS), DEFAULT_TOTAL_PEDIDOS, 100, 10000);
  const seed = numeroEntero(obtenerArgumento('--semilla', DEFAULT_SEED), DEFAULT_SEED, 1, 2147483647);
  const utils = crearUtilidadesAleatorias(seed);

  console.log('\nGenerando datos sintéticos para clasificación y recomendación...\n');
  console.log(`Pedidos solicitados: ${cantidad}`);
  console.log(`Semilla: ${seed}`);

  const productos = await Producto.find({ activo: true, stock: { $gt: 0 } }).lean();
  const usuarios = await Usuario.find({ rol: { $ne: 'admin' } }).lean();

  if (productos.length < 2) {
    throw new Error('Se necesitan al menos 2 productos activos con stock mayor que 0.');
  }
  if (usuarios.length < 1) {
    throw new Error('Se necesita al menos un usuario con rol distinto de admin.');
  }

  const grupos = construirGrupos(productos);
  if (!grupos.length) throw new Error('No fue posible construir grupos de productos.');

  console.log(`Productos disponibles: ${productos.length}`);
  console.log(`Usuarios disponibles: ${usuarios.length}`);
  console.log(`Grupos de afinidad: ${grupos.length}`);

  // Preferencias persistentes por usuario: cada usuario compra repetidamente
  // artículos de uno o dos grupos. Esto crea una señal colaborativa item-item.
  const preferenciasPorUsuario = new Map();
  usuarios.forEach((usuario, index) => {
    const primera = grupos[index % grupos.length];
    const segunda = grupos[(index + 1 + (index % Math.max(1, grupos.length - 1))) % grupos.length];
    preferenciasPorUsuario.set(usuario._id.toString(), primera === segunda ? [primera] : [primera, segunda]);
  });

  const pedidos = [];
  const diasAtras = 365;

  for (let i = 0; i < cantidad; i++) {
    // Round-robin con variación: garantiza varias compras por usuario.
    const baseIndex = i % usuarios.length;
    const usuarioIndex = utils.random() < 0.78 ? baseIndex : utils.entero(0, usuarios.length - 1);
    const usuario = usuarios[usuarioIndex];
    const preferencias = preferenciasPorUsuario.get(usuario._id.toString());
    const productosElegidos = seleccionarProductosPedido(preferencias, productos, utils);

    const destino = utils.elegir(DESTINOS);
    const metodoPago = utils.elegir(METODOS_PAGO);
    const costoEnvio = costoEnvioParaDestino(destino, utils);
    const fechaPedido = fechaAleatoria(utils.random, diasAtras);

    let subtotal = 0;
    const productosPedido = productosElegidos.map((producto) => {
      const cantidadProducto = utils.entero(1, 6);
      const precio = Number(producto.precioNormal) || 100;
      subtotal += precio * cantidadProducto;
      return {
        producto: producto._id,
        cantidad: cantidadProducto,
        precio,
        nombre: producto.nombre
      };
    });

    const total = subtotal + costoEnvio;
    const probabilidadCancelacion = calcularProbabilidadCancelacion({
      metodoPago,
      costoEnvio,
      total,
      destino,
      productos: productosPedido
    });
    const cancelado = utils.random() < probabilidadCancelacion;
    const estado = cancelado ? 'Cancelado' : 'Entregado';

    pedidos.push({
      usuario: usuario._id,
      productos: productosPedido,
      total,
      direccionEnvio: {
        calle: MARKER,
        ciudad: destino.ciudad,
        estado: destino.estado,
        cp: destino.cp,
        telefono: '0000000000'
      },
      metodoPago,
      pago: crearPago({ cancelado, metodoPago, total, fechaPedido, utils }),
      estado,
      costoEnvio,
      inventarioReservado: false,
      fecha: fechaPedido,
      createdAt: fechaPedido,
      updatedAt: fechaPedido
    });
  }

  // Inserción directa: no ejecuta el controller ni descuenta existencias.
  const resultado = await Pedido.collection.insertMany(pedidos, { ordered: false });
  console.log(`\nPedidos sintéticos insertados: ${resultado.insertedCount}`);
  await mostrarResumen(pedidos);
  console.log('\nPara eliminarlos: node seed_ventas2.js --limpiar\n');
}

async function mostrarResumen(pedidos) {
  const entregados = pedidos.filter((p) => p.estado === 'Entregado').length;
  const cancelados = pedidos.filter((p) => p.estado === 'Cancelado').length;
  const lineas = pedidos.reduce((sum, p) => sum + p.productos.length, 0);
  const unidades = pedidos.reduce(
    (sum, p) => sum + p.productos.reduce((subtotal, item) => subtotal + item.cantidad, 0),
    0
  );
  const usuariosUnicos = new Set(pedidos.map((p) => p.usuario.toString())).size;
  const productosUnicos = new Set(
    pedidos.flatMap((p) => p.productos.map((item) => item.producto.toString()))
  ).size;

  console.log('\nResumen:');
  console.log(`  Entregados: ${entregados} (${((entregados / pedidos.length) * 100).toFixed(1)}%)`);
  console.log(`  Cancelados: ${cancelados} (${((cancelados / pedidos.length) * 100).toFixed(1)}%)`);
  console.log(`  Usuarios con interacciones: ${usuariosUnicos}`);
  console.log(`  Productos con interacciones: ${productosUnicos}`);
  console.log(`  Líneas usuario-producto: ${lineas}`);
  console.log(`  Unidades totales: ${unidades}`);
  console.log(`  Productos promedio por pedido: ${(lineas / pedidos.length).toFixed(2)}`);
}

async function limpiarPedidos() {
  const resultado = await Pedido.deleteMany({ 'direccionEnvio.calle': MARKER });
  console.log(`Pedidos sintéticos eliminados: ${resultado.deletedCount}`);
}

async function verPedidos() {
  const total = await Pedido.countDocuments({ 'direccionEnvio.calle': MARKER });
  console.log(`Pedidos sintéticos ML V2: ${total}`);
}

async function verEstadisticas() {
  const estadisticas = await Pedido.aggregate([
    { $match: { 'direccionEnvio.calle': MARKER } },
    {
      $facet: {
        estados: [
          { $group: { _id: '$estado', total: { $sum: 1 } } },
          { $sort: { total: -1 } }
        ],
        metodos: [
          { $group: { _id: '$metodoPago', total: { $sum: 1 } } },
          { $sort: { total: -1 } }
        ],
        interacciones: [
          { $unwind: '$productos' },
          {
            $group: {
              _id: null,
              lineas: { $sum: 1 },
              unidades: { $sum: '$productos.cantidad' },
              usuarios: { $addToSet: '$usuario' },
              productos: { $addToSet: '$productos.producto' }
            }
          },
          {
            $project: {
              _id: 0,
              lineas: 1,
              unidades: 1,
              usuarios: { $size: '$usuarios' },
              productos: { $size: '$productos' }
            }
          }
        ]
      }
    }
  ]);

  if (!estadisticas.length) {
    console.log('No hay datos sintéticos ML V2.');
    return;
  }

  console.log('\nEstados:');
  for (const item of estadisticas[0].estados) console.log(`  ${item._id}: ${item.total}`);
  console.log('\nMétodos de pago:');
  for (const item of estadisticas[0].metodos) console.log(`  ${item._id}: ${item.total}`);
  console.log('\nInteracciones:');
  console.log(estadisticas[0].interacciones[0] || { lineas: 0, unidades: 0, usuarios: 0, productos: 0 });
}

async function main() {
  try {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI no está definida en .env.');

    console.log('Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conexión establecida.');

    if (process.argv.includes('--limpiar')) {
      await limpiarPedidos();
    } else if (process.argv.includes('--ver')) {
      await verPedidos();
    } else if (process.argv.includes('--stats')) {
      await verEstadisticas();
    } else {
      await crearPedidos();
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Conexión cerrada.');
  }
}

main();
