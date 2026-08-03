/**
 * exportar_respaldo_sintetico.js
 *
 * Script para exportar el volcado completo de la base de datos de MongoDB
 * (incluyendo colecciones analíticas y catálogos del sistema) usando MONGO_URI del .env.
 *
 * Uso:
 *   node exportar_respaldo_sintetico.js
 */

require('dotenv').config();
const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Modelos Principales de Analítica
const Producto = require('./models/Producto');
const Usuario = require('./models/Usuario');
const Pedido = require('./models/Pedido');

// Modelos Secundarios y Catálogos del Sistema
const Marca = require('./models/Marca');
const Familia = require('./models/Familia');
const MetodoPago = require('./models/MetodoPago');
const MetodoEnvio = require('./models/MetodoEnvio');
const Empresa = require('./models/Empresa');
const Ubicacion = require('./models/Ubicacion');

const MARCADOR_SINTETICO = 'SINTETICO_ML_V3';

async function exportarRespaldoCompleto() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('❌ Error: No se encontró MONGO_URI en .env');
    process.exit(1);
  }

  console.log('🔄 Conectando a MongoDB desde .env...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Conexión exitosa a la base de datos');

  const carpetaRespaldo = path.join(__dirname, 'respaldo_sintetico_mongodb');
  if (!fs.existsSync(carpetaRespaldo)) {
    fs.mkdirSync(carpetaRespaldo, { recursive: true });
  }

  // 1. Colecciones Analíticas Principales
  console.log('📦 Extrayendo pedidos sintéticos...');
  const pedidosSinteticos = await Pedido.find({
    'direccionEnvio.calle': MARCADOR_SINTETICO
  }).select('-__v').lean();

  const idsUsuariosSet = new Set(
    pedidosSinteticos.map(p => p.usuario ? p.usuario.toString() : null).filter(Boolean)
  );

  console.log('👤 Extrayendo usuarios sintéticos asociad@s...');
  const usuariosSinteticos = await Usuario.find({
    $or: [
      { _id: { $in: Array.from(idsUsuariosSet) } },
      { email: { $regex: /cliente_sintetico_/i } }
    ]
  }).select('-password -activeTokens -alexaTokenHash -loginCode -__v').lean();

  console.log('🛍️ Extrayendo catálogo de productos...');
  const productosSinteticos = await Producto.find({ activo: true }).select('-__v').lean();

  // 2. Colecciones Secundarias / Catálogos del Sistema
  console.log('🏷️ Extrayendo catálogos adicionales (Marcas, Familias, Métodos de Pago, Envíos, Empresa)...');
  const marcas = await Marca.find().select('-__v').lean();
  const familias = await Familia.find().select('-__v').lean();
  const metodosPago = await MetodoPago.find().select('-__v').lean();
  const metodosEnvio = await MetodoEnvio.find().select('-__v').lean();
  const empresa = await Empresa.find().select('-__v').lean();
  const ubicaciones = await Ubicacion.find().select('-__v').lean();

  // 3. Escribir Archivos JSON por Colección
  console.log('💾 Escribiendo archivos JSON por colección...');

  fs.writeFileSync(path.join(carpetaRespaldo, 'pedidos_sinteticos.json'), JSON.stringify(pedidosSinteticos, null, 2), 'utf-8');
  fs.writeFileSync(path.join(carpetaRespaldo, 'usuarios_sinteticos.json'), JSON.stringify(usuariosSinteticos, null, 2), 'utf-8');
  fs.writeFileSync(path.join(carpetaRespaldo, 'productos.json'), JSON.stringify(productosSinteticos, null, 2), 'utf-8');
  fs.writeFileSync(path.join(carpetaRespaldo, 'marcas.json'), JSON.stringify(marcas, null, 2), 'utf-8');
  fs.writeFileSync(path.join(carpetaRespaldo, 'familias.json'), JSON.stringify(familias, null, 2), 'utf-8');
  fs.writeFileSync(path.join(carpetaRespaldo, 'metodos_pago.json'), JSON.stringify(metodosPago, null, 2), 'utf-8');
  fs.writeFileSync(path.join(carpetaRespaldo, 'metodos_envio.json'), JSON.stringify(metodosEnvio, null, 2), 'utf-8');

  // 4. Volcado Unificado Completo
  const volcadoCompleto = {
    metadata: {
      fechaExportacion: new Date().toISOString(),
      baseDeDatos: 'MongoDB',
      sistema: 'Distribuidora Panamericana e-Commerce',
      marcadorSintetico: MARCADOR_SINTETICO,
      resumen: {
        pedidos: pedidosSinteticos.length,
        usuarios: usuariosSinteticos.length,
        productos: productosSinteticos.length,
        marcas: marcas.length,
        familias: familias.length,
        metodosPago: metodosPago.length,
        metodosEnvio: metodosEnvio.length
      }
    },
    colecciones: {
      usuarios: usuariosSinteticos,
      productos: productosSinteticos,
      pedidos: pedidosSinteticos,
      marcas: marcas,
      familias: familias,
      metodosPago: metodosPago,
      metodosEnvio: metodosEnvio,
      empresa: empresa,
      ubicaciones: ubicaciones
    }
  };

  fs.writeFileSync(
    path.join(carpetaRespaldo, 'volcado_completo_mongodb.json'),
    JSON.stringify(volcadoCompleto, null, 2),
    'utf-8'
  );

  console.log('\n🎉 ¡VOLCADO COMPLETO EXPORTADO CON ÉXITO!');
  console.log(`📁 Carpeta de Respaldo: ${carpetaRespaldo}`);
  console.log(`   - volcado_completo_mongodb.json (Volcado total unificado)`);
  console.log(`   - pedidos_sinteticos.json (${pedidosSinteticos.length} registros)`);
  console.log(`   - usuarios_sinteticos.json (${usuariosSinteticos.length} registros)`);
  console.log(`   - productos.json (${productosSinteticos.length} registros)`);
  console.log(`   - marcas.json (${marcas.length} registros)`);
  console.log(`   - familias.json (${familias.length} registros)`);
  console.log(`   - metodos_pago.json (${metodosPago.length} registros)`);
  console.log(`   - metodos_envio.json (${metodosEnvio.length} registros)`);

  await mongoose.disconnect();
  process.exit(0);
}

exportarRespaldoCompleto().catch(err => {
  console.error('❌ Error al exportar volcado:', err);
  process.exit(1);
});
