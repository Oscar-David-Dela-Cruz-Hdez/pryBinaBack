const Producto = require('../models/Producto');
const Oferta = require('../models/Oferta');
const ExcelJS = require('exceljs');

// Función de ayuda para calcular ofertas activas
const aplicarOfertaAProducto = (producto, ofertasActivas) => {
  // Buscar si alguna oferta aplica directamente a este producto
  let ofertaAplicable = ofertasActivas.find(o => 
    o.productos.some(id => id.toString() === producto._id.toString())
  );

  // Si no aplica por producto, checar si aplica por categoría
  if (!ofertaAplicable && producto.categoria) {
    const catId = producto.categoria._id ? producto.categoria._id.toString() : producto.categoria.toString();
    ofertaAplicable = ofertasActivas.find(o => 
      o.categorias.some(id => id.toString() === catId)
    );
  }

  // Convertir a objeto plano si es documento de mongoose
  const prodObj = producto.toObject ? producto.toObject() : producto;

  prodObj.precioOriginal = prodObj.precioBase || prodObj.precio; // Compatibilidad
  
  if (ofertaAplicable) {
    prodObj.ofertaAplicada = {
      nombre: ofertaAplicable.nombre,
      tipoDescuento: ofertaAplicable.tipoDescuento,
      valorDescuento: ofertaAplicable.valorDescuento
    };

    if (ofertaAplicable.tipoDescuento === 'porcentaje') {
      const descuento = prodObj.precioOriginal * (ofertaAplicable.valorDescuento / 100);
      prodObj.precioFinal = Math.max(0, prodObj.precioOriginal - descuento);
    } else if (ofertaAplicable.tipoDescuento === 'monto_fijo') {
      prodObj.precioFinal = Math.max(0, prodObj.precioOriginal - ofertaAplicable.valorDescuento);
    }
  } else {
    prodObj.precioFinal = prodObj.precioOriginal;
  }

  return prodObj;
};

const getProductos = async (req, res) => {
  try {
    const { categoria, nombre } = req.query;
    let query = {};

    if (categoria) {
      query.categoria = categoria;
    }

    if (nombre) {
      // Búsqueda insensible a mayúsculas/minúsculas
      query.nombre = { $regex: nombre, $options: 'i' };
    }

    // Solo devolver productos activos por defecto, salvo que se pida lo contrario en admin
    // query.activo = true; // (Opcional: descomentar si se quiere forzar)

    const productos = await Producto.find(query)
      .populate('categoria', 'nombre');
      
    // Buscar ofertas activas (vigentes hoy)
    const hoy = new Date();
    const ofertasActivas = await Oferta.find({
      activo: true,
      fechaInicio: { $lte: hoy },
      fechaFin: { $gte: hoy }
    });

    const productosConOfertas = productos.map(prod => aplicarOfertaAProducto(prod, ofertasActivas));
    
    res.json(productosConOfertas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener productos" });
  }
};

// Obtener un producto por ID
const getProductoById = async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await Producto.findById(id)
      .populate('categoria', 'nombre');
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const hoy = new Date();
    const ofertasActivas = await Oferta.find({
      activo: true,
      fechaInicio: { $lte: hoy },
      fechaFin: { $gte: hoy }
    });

    const productoConOferta = aplicarOfertaAProducto(producto, ofertasActivas);

    res.json(productoConOferta);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener el producto" });
  }
};

// Crear un nuevo producto
const createProducto = async (req, res) => {
  try {
    const { 
      nombre, descripcion, categoria, activo,
      precio, stock, sku, imagenUrl, // Campos de la versión original
      tieneVariantes, variantesGenerar, precioBase, stockTotal, skuBase, imagenUrlPrincipal
    } = req.body;

    // Si viene req.body.precio, lo usamos para el precio base, de la versión original.
    const _precioBase = precioBase || precio;

    if (!nombre) {
      return res.status(400).json({ error: "Nombre es obligatorio" });
    }
    
    // Si no hay precio base, y tiene variantes, al menos la variante debe tener precio, 
    // pero si no tiene variantes, el precio es obligatorio.
    if (!tieneVariantes && !_precioBase) {
      return res.status(400).json({ error: "El precio base es obligatorio si no tiene variantes" });
    }

    let nuevasVariantes = [];
    
    if (tieneVariantes && variantesGenerar && variantesGenerar.length > 0) {
      nuevasVariantes = variantesGenerar.map(variante => {
        return {
          precio: variante.precio || _precioBase || 0,
          stock: variante.stock || 0,
          sku: variante.sku || '',
          imagenUrl: variante.imagenUrl || '',
          atributos: variante.atributos // Ejemplo: { color: "Rojo" }
        };
      });
    }

    const nuevoProducto = new Producto({
      nombre,
      descripcion,
      categoria,
      activo,
      tieneVariantes,
      variantes: nuevasVariantes,
      precio: _precioBase, // Manteniendo compatibilidad hacia atrás
      precioBase: _precioBase,
      stock: stock || stockTotal, // Manteniendo compatibilidad
      stockTotal: stockTotal || stock,
      sku: sku || skuBase, // Manteniendo compatibilidad
      skuBase: skuBase || sku,
      imagenUrl: imagenUrl || imagenUrlPrincipal, // Manteniendo compatibilidad
      imagenUrlPrincipal: imagenUrlPrincipal || imagenUrl
    });

    await nuevoProducto.save();
    res.status(201).json({ mensaje: "Producto creado con éxito", producto: nuevoProducto });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear el producto" });
  }
};

// Actualizar un producto
const updateProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, precio, stock, categoria, sku, imagenUrl, activo } = req.body;

    const producto = await Producto.findByIdAndUpdate(
      id,
      { nombre, descripcion, precio, stock, categoria, sku, imagenUrl, activo },
      { new: true } // Devuelve el objeto actualizado
    );

    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ mensaje: "Producto actualizado", producto });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar el producto" });
  }
};

// Eliminar un producto
const deleteProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await Producto.findByIdAndDelete(id);

    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ mensaje: "Producto eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al eliminar el producto" });
  }
};
///
///
////NUEVOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO
// Exportar productos a Excel
const exportarProductosExcel = async (req, res) => {
  try {
    const productos = await Producto.find().populate('categoria', 'nombre');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Productos');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 25 },
      { header: 'Nombre', key: 'nombre', width: 30 },
      { header: 'Descripción', key: 'descripcion', width: 40 },
      { header: 'Precio Base', key: 'precioBase', width: 15 },
      { header: 'Stock Total', key: 'stockTotal', width: 15 },
      { header: 'SKU Base', key: 'skuBase', width: 20 },
      { header: 'Categoría', key: 'categoria', width: 20 },
      { header: 'Activo', key: 'activo', width: 10 },
      { header: 'Tiene Variantes', key: 'tieneVariantes', width: 15 }
    ];

    productos.forEach(prod => {
      worksheet.addRow({
        id: prod._id.toString(),
        nombre: prod.nombre,
        descripcion: prod.descripcion || '',
        precioBase: prod.precioBase !== undefined ? prod.precioBase : (prod.precio || 0),
        stockTotal: prod.stockTotal !== undefined ? prod.stockTotal : (prod.stock || 0),
        skuBase: prod.skuBase || prod.sku || '',
        categoria: prod.categoria ? prod.categoria.nombre : '',
        activo: prod.activo ? 'Sí' : 'No',
        tieneVariantes: prod.tieneVariantes ? 'Sí' : 'No'
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + 'productos.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error al exportar productos:', error);
    res.status(500).json({ error: "Error al exportar productos" });
  }
};
///
///
////NUEVOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO
// Importar productos desde Excel
const importarProductosExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se proporcionó ningún archivo" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    
    // para que esa información se ponga en la primera hoja
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      return res.status(400).json({ error: "El archivo Excel no tiene hojas válidas" });
    }
    
    const resumen = { creados: 0, actualizados: 0, errores: 0, detallesErrores: [] };

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      if (!row.hasValues) continue;

      const id = row.getCell(1).value;
      const nombre = row.getCell(2).value;
      const descripcion = row.getCell(3).value;
      const precioBase = row.getCell(4).value;
      const stockTotal = row.getCell(5).value;
      const skuBase = row.getCell(6).value;

      try {
        if (!nombre) {
          throw new Error("El nombre es obligatorio");
        }

        let producto = null;
        if (id && id.toString().length === 24) {
          // Intentar buscar por ID si parece un ObjectId válido
          producto = await Producto.findById(id.toString());
        }

        if (!producto && skuBase) {
          // Intentar buscar por SKU si no se encontró por ID
          producto = await Producto.findOne({ skuBase: skuBase.toString() });
        }

        // Determinar un precio seguro
        let precioSeguro = 0;
        if (precioBase !== null && precioBase !== undefined) {
             const parsed = parseFloat(precioBase.toString().replace(/,/g, ''));
             if(!isNaN(parsed)) precioSeguro = parsed;
        }

        let stockSeguro = 0;
        if (stockTotal !== null && stockTotal !== undefined) {
             const parsed = parseInt(stockTotal.toString().replace(/,/g, ''), 10);
             if(!isNaN(parsed)) stockSeguro = parsed;
        }

        if (producto) {
          // Actualizar
          producto.nombre = nombre.toString();
          if(descripcion !== null && descripcion !== undefined) {
             producto.descripcion = descripcion.toString();
          }
          producto.precio = precioSeguro;
          producto.precioBase = precioSeguro;
          producto.stock = stockSeguro;
          producto.stockTotal = stockSeguro;
          if (skuBase) {
              producto.sku = skuBase.toString();
              producto.skuBase = skuBase.toString();
          }
          await producto.save();
          resumen.actualizados++;
        } else {
          // Crear
          const nuevoProd = new Producto({
            nombre: nombre.toString(),
            descripcion: descripcion ? descripcion.toString() : '',
            precio: precioSeguro,
            precioBase: precioSeguro,
            stock: stockSeguro,
            stockTotal: stockSeguro,
            sku: skuBase ? skuBase.toString() : '',
            skuBase: skuBase ? skuBase.toString() : '',
            tieneVariantes: false,
            activo: true
          });
          await nuevoProd.save();
          resumen.creados++;
        }
      } catch (err) {
        resumen.errores++;
        resumen.detallesErrores.push(`Fila ${i}: ${err.message}`);
      }
    }

    res.json({ mensaje: "Importación finalizada", resumen });
  } catch (error) {
    console.error('Error al importar productos:', error);
    res.status(500).json({ error: "Error al importar productos" });
  }
};

module.exports = {
  getProductos,
  getProductoById,
  createProducto,
  updateProducto,
  deleteProducto,
  exportarProductosExcel,
  importarProductosExcel
};
