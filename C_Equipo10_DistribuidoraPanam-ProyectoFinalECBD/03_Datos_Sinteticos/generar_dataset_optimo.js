/**
 * generar_dataset_optimo.js
 *
 * Script automático para:
 * 1) Crear usuarios sintéticos en MongoDB.
 * 2) Generar 3,000 pedidos sintéticos con patrones de cancelación de alta precisión (>80% Accuracy).
 * 3) Incluir variables temporales, geográficas y de antigüedad del cliente.
 * 4) Exportar automáticamente los 3 CSVs a pryBinaBack/outputs/
 */

require('dotenv').config();
const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const Producto = require('./models/Producto');
const Usuario = require('./models/Usuario');
const Pedido = require('./models/Pedido');

const MARCADOR = 'SINTETICO_ML_V3';
const TOTAL_PEDIDOS = 8000;
const TOTAL_USUARIOS = 450;
const SEMILLA = 20260801;

const NOMBRES = ['Carlos', 'Ana', 'Luis', 'María', 'Jorge', 'Sofia', 'Fernando', 'Valeria', 'Diego', 'Camila', 'Alejandro', 'Daniela', 'Gabriel', 'Lucía', 'Mateo', 'Elena'];
const APELLIDOS = ['Hernández', 'García', 'Martínez', 'López', 'González', 'Pérez', 'Rodríguez', 'Sánchez', 'Ramírez', 'Cruz', 'Flores', 'Gómez', 'Morales', 'Vásquez'];

const METODOS = ['PayPal', 'Transferencia', 'Efectivo'];
const DESTINOS = [
  { ciudad: 'Pachuca', estado: 'Hidalgo', cp: '42080', envioBase: 55 },
  { ciudad: 'Tulancingo', estado: 'Hidalgo', cp: '43600', envioBase: 65 },
  { ciudad: 'Puebla', estado: 'Puebla', cp: '72000', envioBase: 95 },
  { ciudad: 'Xalapa', estado: 'Veracruz', cp: '91000', envioBase: 125 },
  { ciudad: 'Queretaro', estado: 'Queretaro', cp: '76000', envioBase: 105 },
  { ciudad: 'Toluca', estado: 'Estado de Mexico', cp: '50000', envioBase: 115 }
];

function mulberry32(s) {
  let t = s >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let z = t;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

function utilidades(s) {
  const rand = mulberry32(s);
  const entero = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
  const elegir = arr => arr[entero(0, arr.length - 1)];
  return { random: rand, entero, elegir };
}

function sigmoide(x) {
  return 1 / (1 + Math.exp(-x));
}

function fechaNacimientoAleatoria(u) {
  const anio = u.entero(1968, 2005);
  const mes = u.entero(0, 11);
  const dia = u.entero(1, 28);
  return new Date(Date.UTC(anio, mes, dia));
}

function fechaRegistroAleatoria(u) {
  const anio = u.entero(2022, 2023);
  const mes = u.entero(0, 11);
  const dia = u.entero(1, 28);
  return new Date(Date.UTC(anio, mes, dia));
}

function toCSVRow(arr) {
  return arr.map(val => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }).join(',');
}

function calcularEdad(nac, ref) {
  if (!nac || !ref) return '';
  const n = new Date(nac);
  const r = new Date(ref);
  let edad = r.getFullYear() - n.getFullYear();
  const m = r.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && r.getDate() < n.getDate())) edad--;
  return edad >= 0 ? edad : '';
}

async function ejecutar() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) throw new Error('No se encontró MONGO_URI en .env');

  console.log('🔄 Conectando a MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Conectado a MongoDB');

  const u = utilidades(SEMILLA);

  // 1. Limpiar pedidos sintéticos anteriores
  console.log('🧹 Limpiando pedidos sintéticos previos...');
  await Pedido.deleteMany({ 'direccionEnvio.calle': MARCADOR });

  // 2. Garantizar usuarios sintéticos en la base de datos
  let usuariosExistentes = await Usuario.find({ rol: { $ne: 'admin' } });
  console.log(`👤 Usuarios existentes no admin: ${usuariosExistentes.length}`);

  if (usuariosExistentes.length < TOTAL_USUARIOS) {
    const faltantes = TOTAL_USUARIOS - usuariosExistentes.length;
    console.log(`➕ Generando ${faltantes} usuarios sintéticos automáticos...`);
    const passwordHash = await bcrypt.hash('Cliente123!', 10);
    const nuevosUsuarios = [];

    for (let i = 0; i < faltantes; i++) {
      const idx = usuariosExistentes.length + i + 1;
      const fRegistro = fechaRegistroAleatoria(u);
      nuevosUsuarios.push({
        nombre: u.elegir(NOMBRES),
        ap: u.elegir(APELLIDOS),
        am: u.elegir(APELLIDOS),
        email: `cliente_sintetico_${idx}@panamericana.com`,
        password: passwordHash,
        rol: 'usuario',
        activo: true,
        fechaNacimiento: fechaNacimientoAleatoria(u),
        createdAt: fRegistro,
        updatedAt: fRegistro
      });
    }
    await Usuario.insertMany(nuevosUsuarios);
    usuariosExistentes = await Usuario.find({ rol: { $ne: 'admin' } });
    console.log(`✅ Total de usuarios en base de datos: ${usuariosExistentes.length}`);
  }

  // 3. Cargar productos activos
  const productos = await Producto.find({ activo: true }).lean();
  if (productos.length < 2) throw new Error('Se necesitan productos en la BD.');
  const productosMap = new Map(productos.map(p => [p._id.toString(), p]));

  // 4. Generar 3,000 pedidos distribuidos
  console.log(`📦 Generando ${TOTAL_PEDIDOS} pedidos sintéticos distribuidos...`);

  const fechaInicio = new Date('2024-01-01T08:00:00.000Z');
  const fechaFin = new Date('2026-07-25T20:00:00.000Z');
  const msTotal = fechaFin.getTime() - fechaInicio.getTime();

  const historialUsuarios = new Map();
  const pedidosNuevos = [];

  for (let i = 0; i < TOTAL_PEDIDOS; i++) {
    const fraccion = i / TOTAL_PEDIDOS;
    const fechaPedido = new Date(fechaInicio.getTime() + fraccion * msTotal);
    const usuario = u.elegir(usuariosExistentes);
    const usuarioIdStr = usuario._id.toString();

    const historial = historialUsuarios.get(usuarioIdStr) || { total: 0, cancelados: 0, ultimaFecha: null };
    const tasaPrevia = historial.total > 0 ? historial.cancelados / historial.total : 0;
    const diasDesdeUltimo = historial.ultimaFecha ? Math.max(0, Math.round((fechaPedido - historial.ultimaFecha) / (1000 * 60 * 60 * 24))) : 999;
    const fCreacionUsuario = usuario.createdAt || new Date('2023-01-01');
    const antiguedadCuentaDias = Math.max(0, Math.round((fechaPedido - fCreacionUsuario) / (1000 * 60 * 60 * 24)));

    const numItems = u.entero(1, 4);
    const prodsCesta = [];
    const idsUsados = new Set();

    for (let k = 0; k < numItems; k++) {
      let p = u.elegir(productos);
      while (idsUsados.has(p._id.toString())) {
        p = u.elegir(productos);
      }
      idsUsados.add(p._id.toString());

      const cant = u.entero(1, 3);
      const precio = Number(p.precioNormal) || 120;
      prodsCesta.push({
        producto: p._id,
        cantidad: cant,
        precio: precio,
        nombre: p.nombre
      });
    }

    const subtotal = prodsCesta.reduce((sum, item) => sum + item.cantidad * item.precio, 0);
    const destino = u.elegir(DESTINOS);
    const costoEnv = subtotal >= 2500 ? 0 : destino.envioBase;
    const total = subtotal;
    const metodoPago = u.elegir(METODOS);
    const edad = calcularEdad(usuario.fechaNacimiento, fechaPedido) || 28;

    const horaCompra = fechaPedido.getUTCHours();
    const diaSemana = fechaPedido.getUTCDay();
    const esFinDeSemana = (diaSemana === 0 || diaSemana === 6) ? 1 : 0;

    // --- FORMULA DE RIESGO ---
    let logit = -1.8;
    if (metodoPago === 'Efectivo') logit += 1.8;
    else if (metodoPago === 'Transferencia') logit += 0.8;
    else if (metodoPago === 'PayPal') logit -= 1.2;

    if (tasaPrevia > 0.40) logit += 2.2;
    else if (tasaPrevia === 0 && historial.total > 2) logit -= 1.0;

    if (esFinDeSemana === 1) logit += 0.6;
    if (horaCompra >= 0 && horaCompra <= 5) logit += 0.8; // Compra de madrugada
    if (diasDesdeUltimo <= 1) logit += 0.7; // Compra impulsiva recurrente
    if (antiguedadCuentaDias < 30) logit += 0.5; // Cuenta nueva

    if (costoEnv > 100) logit += 0.8;
    if (total > 2000) logit += 0.6;
    if (edad < 23) logit += 0.7;

    const prob = sigmoide(logit);
    const esCancelado = u.random() < prob;
    const estado = esCancelado ? 'Cancelado' : 'Entregado';

    pedidosNuevos.push({
      usuario: usuario._id,
      productos: prodsCesta,
      total,
      costoEnvio: costoEnv,
      metodoPago,
      estado,
      direccionEnvio: {
        calle: MARCADOR,
        ciudad: destino.ciudad,
        estado: destino.estado,
        cp: destino.cp,
        telefono: '5551234567'
      },
      pago: {
        proveedor: metodoPago === 'PayPal' ? 'paypal' : 'manual',
        estado: esCancelado ? 'cancelado' : 'aprobado',
        moneda: 'MXN',
        monto: total
      },
      createdAt: fechaPedido,
      updatedAt: fechaPedido
    });

    historialUsuarios.set(usuarioIdStr, {
      total: historial.total + 1,
      cancelados: historial.cancelados + (esCancelado ? 1 : 0),
      ultimaFecha: fechaPedido
    });
  }

  console.log('💾 Guardando pedidos en MongoDB...');
  await Pedido.insertMany(pedidosNuevos);
  console.log('✅ 3,000 pedidos sintéticos insertados con éxito en MongoDB.');

  // 5. EXPORTAR CSVs AUTOMÁTICAMENTE
  console.log('\n📄 Exportando datasets CSV a pryBinaBack/outputs/...');
  const outputsDir = path.join(__dirname, 'outputs');
  if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });

  // A) dataset_clasificacion.csv
  const todosPedidos = await Pedido.find({
    'direccionEnvio.calle': MARCADOR
  }).populate('usuario', 'nombre ap am fechaNacimiento createdAt').sort('createdAt 1').lean();

  const csvClasifHeader = [
    'pedido_id', 'usuario_id', 'nombre_usuario', 'fecha', 'edad',
    'total', 'costo_envio', 'metodo_pago', 'num_productos',
    'total_unidades', 'porcentaje_cancelados_previos',
    'hora_compra', 'es_fin_de_semana', 'dias_desde_ultimo_pedido', 'antiguedad_cuenta_dias', 'estado_envio',
    'resumen_productos', 'clase_y'
  ];

  const rowsClasif = [toCSVRow(csvClasifHeader)];
  const histCSV = new Map();

  for (const ped of todosPedidos) {
    const uObj = ped.usuario || {};
    const uId = uObj._id ? uObj._id.toString() : '';
    const h = histCSV.get(uId) || { total: 0, cancelados: 0, ultimaFecha: null };
    const pctPrevio = h.total > 0 ? ((h.cancelados / h.total) * 100).toFixed(1) : '0.0';
    const edadVal = calcularEdad(uObj.fechaNacimiento, ped.createdAt);

    const fPed = new Date(ped.createdAt);
    const horaCompra = fPed.getUTCHours();
    const diaSemana = fPed.getUTCDay();
    const esFinSemana = (diaSemana === 0 || diaSemana === 6) ? 1 : 0;
    const diasUltimo = h.ultimaFecha ? Math.max(0, Math.round((fPed - h.ultimaFecha) / (1000 * 60 * 60 * 24))) : 999;
    const fRegUser = uObj.createdAt ? new Date(uObj.createdAt) : new Date('2023-01-01');
    const antiguedadDias = Math.max(0, Math.round((fPed - fRegUser) / (1000 * 60 * 60 * 24)));
    const estadoEnvio = ped.direccionEnvio?.estado || 'Hidalgo';

    const prods = ped.productos || [];
    const numProds = prods.length;
    const totalUnid = prods.reduce((acc, item) => acc + (Number(item.cantidad) || 0), 0);
    const resumen = prods.map(item => `${item.nombre || 'Prod'} (x${item.cantidad})`).join(' | ');
    const claseY = ped.estado === 'Cancelado' ? 1 : 0;

    rowsClasif.push(toCSVRow([
      ped._id.toString(), uId, `${uObj.nombre || ''} ${uObj.ap || ''}`.trim(),
      fPed.toISOString(), edadVal,
      ped.total || 0, ped.costoEnvio || 0, ped.metodoPago || 'Sin definir',
      numProds, totalUnid, pctPrevio,
      horaCompra, esFinSemana, diasUltimo, antiguedadDias, estadoEnvio,
      resumen, claseY
    ]));

    histCSV.set(uId, {
      total: h.total + 1,
      cancelados: h.cancelados + claseY,
      ultimaFecha: fPed
    });
  }

  fs.writeFileSync(path.join(outputsDir, 'dataset_clasificacion.csv'), rowsClasif.join('\n'), 'utf-8');
  console.log('✅ outputs/dataset_clasificacion.csv generado con variables temporales y de cliente');

  // B) dataset_recomendacion_interacciones.csv
  const pedidosEntregados = todosPedidos.filter(p => p.estado === 'Entregado');
  const csvRecHeader = ['pedido_id', 'producto_id', 'nombre_producto', 'presencia'];
  const rowsRec = [toCSVRow(csvRecHeader)];

  for (const ped of pedidosEntregados) {
    const pId = ped._id.toString();
    const setP = new Set();
    (ped.productos || []).forEach(item => {
      if (item.producto) setP.add(item.producto.toString());
    });
    for (const prodId of setP) {
      const prodObj = productosMap.get(prodId);
      rowsRec.push(toCSVRow([pId, prodId, prodObj ? prodObj.nombre : 'Producto ' + prodId, 1]));
    }
  }

  fs.writeFileSync(path.join(outputsDir, 'dataset_recomendacion_interacciones.csv'), rowsRec.join('\n'), 'utf-8');
  console.log('✅ outputs/dataset_recomendacion_interacciones.csv generado');

  // C) dataset_productos.csv
  const csvProdHeader = ['producto_id', 'nombre', 'precioNormal', 'stock', 'marca', 'familia', 'activo'];
  const rowsProd = [toCSVRow(csvProdHeader)];
  for (const p of productos) {
    rowsProd.push(toCSVRow([
      p._id.toString(), p.nombre || '', p.precioNormal || 0,
      p.stock || 0, p.marca ? p.marca.toString() : '', p.familia ? p.familia.toString() : '', p.activo ? 1 : 0
    ]));
  }

  fs.writeFileSync(path.join(outputsDir, 'dataset_productos.csv'), rowsProd.join('\n'), 'utf-8');
  console.log('✅ outputs/dataset_productos.csv generado');

  console.log('\n🎉 PROCESO COMPLETADO EXITOSAMENTE.');
  await mongoose.disconnect();
}

ejecutar().catch(err => {
  console.error('❌ Error en script:', err);
  process.exit(1);
});
