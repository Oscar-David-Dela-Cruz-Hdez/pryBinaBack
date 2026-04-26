/**
 * seed_ventas.js
 * ─────────────────────────────────────────────────────────────────
 * Genera pedidos SIMULADOS con estado "Entregado" para probar el
 * modelo matemático de predicción de inventario en /admin/ventas/reportes
 *
 * SEGURIDAD:
 *   - Solo escribe en la colección "pedidos"
 *   - NO modifica stock de productos
 *   - Todos los registros tienen direccionEnvio.calle = "SIMULADO_TEST"
 *     lo que permite identificarlos y eliminarlos fácilmente
 *
 * USO:
 *   node seed_ventas.js             → Crea los pedidos simulados
 *   node seed_ventas.js --limpiar   → Elimina SOLO los pedidos simulados
 *   node seed_ventas.js --ver       → Muestra cuántos pedidos simulados hay
 * ─────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ── Modelos ──────────────────────────────────────────────────────
const Producto = require('./models/Producto');
const Usuario  = require('./models/Usuario');
const Pedido   = require('./models/Pedido');

// ── Configuración de la simulación ───────────────────────────────
const getDiasDesdeEnero = () => {
  const hoy = new Date();
  const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  const diffTime = Math.abs(ayer - inicioAnio);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const CONFIG = {
  TOTAL_PEDIDOS:    300,  // Aumentado para cubrir desde enero
  DIAS_ATRAS:       getDiasDesdeEnero(), 
  UNIDADES_MIN:      1,   
  UNIDADES_MAX:      8,   // Un poco más de variabilidad
  PRODUCTOS_POR_PEDIDO_MIN: 1,
  PRODUCTOS_POR_PEDIDO_MAX: 4,
  MARKER: 'SIMULADO_TEST' 
};

// ── Utilidades ───────────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const fechaAleatoria = (diasAtras) => {
  const ahora = new Date();
  const diaElegido = rand(1, diasAtras);
  ahora.setDate(ahora.getDate() - diaElegido);
  // Hora aleatoria para que no todos caigan a medianoche
  ahora.setHours(rand(8, 22), rand(0, 59), rand(0, 59));
  return new Date(ahora);
};

const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

// ── Función principal: Crear pedidos ─────────────────────────────
async function crearPedidos() {
  console.log('\n🚀 Iniciando generación de pedidos simulados...\n');

  // 1. Obtener productos activos con stock disponible
  const productos = await Producto.find({ activo: true, stock: { $gt: 0 } }).lean();
  if (productos.length === 0) {
    console.error('❌ No hay productos activos con stock en la base de datos.');
    console.log('   Asegúrate de tener productos antes de ejecutar el seed.');
    return;
  }
  console.log(`✅ Productos encontrados: ${productos.length}`);

  // 2. Obtener usuarios no-admin
  const usuarios = await Usuario.find({ rol: { $ne: 'admin' } }).lean();
  if (usuarios.length === 0) {
    console.error('❌ No hay usuarios no-admin en la base de datos.');
    console.log('   Se necesita al menos un usuario cliente para los pedidos.');
    return;
  }
  console.log(`✅ Usuarios clientes encontrados: ${usuarios.length}`);

  // 3. Métodos de pago disponibles (simulados)
  const metodosPago = ['Tarjeta', 'Transferencia', 'Efectivo'];

  // 4. Generar los pedidos
  const pedidosAInsertar = [];

  for (let i = 0; i < CONFIG.TOTAL_PEDIDOS; i++) {
    // Usuario aleatorio
    const usuario = usuarios[rand(0, usuarios.length - 1)];

    // Seleccionar N productos aleatorios para este pedido
    const numProductos = rand(
      CONFIG.PRODUCTOS_POR_PEDIDO_MIN,
      Math.min(CONFIG.PRODUCTOS_POR_PEDIDO_MAX, productos.length)
    );
    const productosElegidos = shuffle([...productos]).slice(0, numProductos);

    let total = 0;
    const productosDelPedido = productosElegidos.map(p => {
      const cantidad = rand(CONFIG.UNIDADES_MIN, CONFIG.UNIDADES_MAX);
      const precio   = p.precioNormal || 100; // fallback si no tiene precio
      total += precio * cantidad;
      return {
        producto : p._id,
        nombre   : p.nombre,
        cantidad,
        precio
      };
    });

    const costoEnvio = rand(0, 1) === 1 ? rand(50, 200) : 0;
    total += costoEnvio;

    const fechaPedido = fechaAleatoria(CONFIG.DIAS_ATRAS);

    pedidosAInsertar.push({
      usuario      : usuario._id,
      productos    : productosDelPedido,
      total,
      costoEnvio,
      metodoPago   : metodosPago[rand(0, metodosPago.length - 1)],
      estado       : 'Entregado',
      direccionEnvio: {
        calle   : CONFIG.MARKER,   // ← MARCADOR para identificar y borrar
        ciudad  : 'Ciudad Simulada',
        estado  : 'Estado Simulado',
        cp      : '00000',
        telefono: '0000000000'
      },
      fecha      : fechaPedido,
      createdAt  : fechaPedido,
      updatedAt  : fechaPedido
    });
  }

  // 5. Insertar en MongoDB (directo, sin pasar por el controller)
  //    insertMany + timestamps:false para respetar las fechas simuladas
  const resultado = await Pedido.collection.insertMany(pedidosAInsertar);
  console.log(`\n✅ Se insertaron ${resultado.insertedCount} pedidos simulados con éxito.`);

  // 6. Resumen
  const totalUnidadesSimuladas = pedidosAInsertar.reduce((sum, p) =>
    sum + p.productos.reduce((s, pr) => s + pr.cantidad, 0), 0
  );

  console.log('\n📊 Resumen de la simulación:');
  console.log(`   • Pedidos creados    : ${resultado.insertedCount}`);
  console.log(`   • Unidades simuladas : ${totalUnidadesSimuladas}`);
  console.log(`   • Periodo simulado   : desde 01 de Enero (~${CONFIG.DIAS_ATRAS} días)`);
  console.log(`   • Estado de pedidos  : Entregado`);
  console.log(`   • Marcador de limpieza: "${CONFIG.MARKER}"`);
  console.log('\n💡 Ahora ve a /admin/ventas/reportes y verás la curva del modelo.');
  console.log('   Para eliminar estos pedidos de prueba ejecuta:');
  console.log('   node seed_ventas.js --limpiar\n');
}

// ── Función de limpieza: Borrar solo pedidos simulados ───────────
async function limpiarPedidos() {
  console.log('\n🧹 Limpiando pedidos simulados...\n');

  const resultado = await Pedido.deleteMany({
    'direccionEnvio.calle': CONFIG.MARKER
  });

  console.log(`✅ Se eliminaron ${resultado.deletedCount} pedidos simulados.`);
  console.log('   La base de datos real no fue afectada.\n');
}

// ── Función informativa: ¿Cuántos hay? ───────────────────────────
async function verPedidos() {
  console.log('\n🔍 Consultando pedidos simulados...\n');

  const count = await Pedido.countDocuments({
    'direccionEnvio.calle': CONFIG.MARKER
  });

  console.log(`📋 Pedidos simulados en la BD: ${count}`);
  if (count === 0) {
    console.log('   No hay pedidos de prueba actualmente.');
  } else {
    console.log(`   Ejecuta "node seed_ventas.js --limpiar" para eliminarlos.\n`);
  }
}

// ── Función de estadísticas: Total de unidades vendidas ──────────
async function verStats() {
  console.log('\n📊 Calculando estadísticas de pedidos simulados...\n');

  const result = await Pedido.aggregate([
    { $match: { 'direccionEnvio.calle': CONFIG.MARKER } },
    { $unwind: '$productos' },
    {
      $group: {
        _id: null,
        totalPedidos  : { $sum: 1 },
        totalUnidades : { $sum: '$productos.cantidad' },
        totalIngresos : { $sum: { $multiply: ['$productos.cantidad', '$productos.precio'] } }
      }
    }
  ]);

  // countDocuments para el número exacto de pedidos (el group cuenta líneas de producto)
  const totalPedidos = await Pedido.countDocuments({ 'direccionEnvio.calle': CONFIG.MARKER });

  if (!result.length || totalPedidos === 0) {
    console.log('❌ No hay pedidos simulados en la BD.\n');
    return;
  }

  const { totalUnidades, totalIngresos } = result[0];

  console.log('─────────────────────────────────────────');
  console.log(`  📦 Total de pedidos simulados : ${totalPedidos}`);
  console.log(`  🛍️  Total de unidades vendidas : ${totalUnidades}`);
  console.log(`  💰 Ingreso simulado total     : $${totalIngresos.toFixed(2)}`);
  console.log('─────────────────────────────────────────');
  console.log('\n💡 El modelo usa "totalUnidades" para calibrar K.');
  console.log(`   x(0) = stock actual,  ventas(30días) = ${totalUnidades}`);
  console.log(`   k = -ln( x0 / (x0 + ${totalUnidades}) ) / 30\n`);
}

// ── Bootstrap ────────────────────────────────────────────────────
async function main() {
  try {
    console.log('🔌 Conectando a MongoDB Atlas...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conexión establecida.\n');

    const args = process.argv.slice(2);

    if (args.includes('--limpiar')) {
      await limpiarPedidos();
    } else if (args.includes('--ver')) {
      await verPedidos();
    } else if (args.includes('--stats')) {
      await verStats();
    } else {
      await crearPedidos();
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Conexión cerrada.');
  }
}

main();
