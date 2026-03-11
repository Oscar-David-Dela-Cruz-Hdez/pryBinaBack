const archiver = require('archiver');
const mongoose = require('mongoose');

// Obtener lista de colecciones disponibles
const obtenerColecciones = (req, res) => {
  try {
    // Obtenemos todos los nombres de los modelos registrados en Mongoose
    const modelos = mongoose.modelNames();
    
    // Filtramos el modelo Informacion como se solicitó
    const coleccionesDisponibles = modelos.filter(modelo => modelo !== 'Informacion');
    
    res.status(200).json(coleccionesDisponibles);
  } catch (error) {
    console.error('Error al obtener colecciones para respaldo:', error);
    res.status(500).json({ error: 'Error al obtener las colecciones disponibles' });
  }
};

// Generar y descargar el respaldo en formato ZIP
const generarRespaldo = async (req, res) => {
  try {
    const { colecciones } = req.body;

    if (!colecciones || !Array.isArray(colecciones) || colecciones.length === 0) {
      return res.status(400).json({ error: 'Debe proporcionar un arreglo con las colecciones a respaldar' });
    }

    // Configuramos las cabeceras para que el navegador entienda que es un archivo descargable
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="respaldo_bd_${new Date().toISOString().split('T')[0]}.zip"`);

    // Iniciamos archiver
    const archive = archiver('zip', {
      zlib: { level: 9 } // Nivel máximo de compresión
    });

    // Manejo de errores de archiver
    archive.on('error', function(err) {
      console.error('Error en archiver:', err);
      throw err;
    });

    // Conectamos el archivo ZIP a la respuesta HTTP (para enviarlo en streaming)
    archive.pipe(res);

    // Recorremos las colecciones solicitadas
    for (const nombreColeccion of colecciones) {
      // Por seguridad doble, omitimos 'Informacion' si la enviaron
      if (nombreColeccion === 'Informacion') continue;
      
      // Verificamos que el modelo exista
      if (mongoose.modelNames().includes(nombreColeccion)) {
        const Modelo = mongoose.model(nombreColeccion);
        
        // Obtenemos todos los documentos de esa colección
        const datos = await Modelo.find({}).lean(); 
        
        // Añadimos un archivo JSON al ZIP con los datos
        archive.append(JSON.stringify(datos, null, 2), { name: `${nombreColeccion}.json` });
      }
    }

    // Finalizamos la creación del ZIP (esto cerrará automáticamente la respuesta http)
    await archive.finalize();

  } catch (error) {
    console.error('Error al generar el respaldo:', error);
    // Solo enviamos respuesta de error si las cabeceras no se han enviado ya
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al generar el respaldo de la base de datos' });
    }
  }
};

module.exports = {
  obtenerColecciones,
  generarRespaldo
};
