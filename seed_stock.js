require('dotenv').config();
const mongoose = require('mongoose');
const Producto = require('./models/Producto');

async function seedStock() {
  try {
    console.log('--- Iniciando actualización de Stock Aleatorio ---');
    
    // Conectar a la base de datos
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI no definida en el archivo .env');
    }
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conexión exitosa a MongoDB.');

    // Obtener todos los productos
    const productos = await Producto.find({});
    console.log(`Se encontraron ${productos.length} productos.`);

    let actualizados = 0;
    
    // Actualizar cada producto
    for (const prod of productos) {
      // Generar stock aleatorio entre 30 y 50
      const nuevoStock = Math.floor(Math.random() * (50 - 30 + 1)) + 30;
      
      prod.stock = nuevoStock;
      await prod.save();
      
      actualizados++;
      if (actualizados % 10 === 0) {
        console.log(`Progreso: ${actualizados}/${productos.length} productos actualizados...`);
      }
    }

    console.log(`\n¡Éxito! Se actualizó el stock de ${actualizados} productos.`);
    console.log('Rango aplicado: 30 a 50 unidades por producto.');

  } catch (error) {
    console.error('Error durante la actualización:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB.');
    process.exit();
  }
}

seedStock();
