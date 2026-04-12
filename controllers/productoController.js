const Producto = require('../models/Producto');
const Oferta = require('../models/Oferta');
const Marca = require('../models/Marca');
const Familia = require('../models/Familia');
const ExcelJS = require('exceljs');

const obtenerOfertaParaProducto = (producto, ofertasActivas) => {
  // 1. Buscar oferta directa al producto
  let oferta = ofertasActivas.find(o => 
    o.productos?.some(id => id.toString() === producto._id.toString())
  );

  // 2. Si no hay, buscar oferta por marca
  if (!oferta && producto.marca) {
    const marcaId = producto.marca._id?.toString() || producto.marca.toString();
    oferta = ofertasActivas.find(o => 
      o.marcas?.some(id => id.toString() === marcaId)
    );
  }
  return oferta;
};

const calcularPrecioConDescuento = (precio, oferta) => {
  if (!precio || !oferta) return precio;
  
  if (oferta.tipoDescuento === 'porcentaje') {
    const descuento = precio * (oferta.valorDescuento / 100);
    return Math.max(0, precio - descuento);
  }
  
  if (oferta.tipoDescuento === 'monto_fijo') {
    return Math.max(0, precio - oferta.valorDescuento);
  }
  
  return precio;
};

const aplicarOfertaAProducto = (producto, ofertasActivas) => {
  const ofertaAplicable = obtenerOfertaParaProducto(producto, ofertasActivas);
  const prodObj = producto.toObject?.() || { ...producto };

  // Inicializar precios finales con los originales por defecto
  prodObj.precioNormalFinal = prodObj.precioNormal;
  prodObj.precioMayoreoFinal = prodObj.precioMayoreo;
  prodObj.precioCajaFinal = prodObj.precioCaja;

  if (ofertaAplicable && prodObj.precioNormal) {
    prodObj.ofertaAplicada = {
      nombre: ofertaAplicable.nombre,
      tipoDescuento: ofertaAplicable.tipoDescuento,
      valorDescuento: ofertaAplicable.valorDescuento
    };

    prodObj.precioNormalFinal = calcularPrecioConDescuento(prodObj.precioNormal, ofertaAplicable);
    prodObj.precioMayoreoFinal = calcularPrecioConDescuento(prodObj.precioMayoreo, ofertaAplicable);
    prodObj.precioCajaFinal = calcularPrecioConDescuento(prodObj.precioCaja, ofertaAplicable);
  }
  
  // Compatibilidad hacia atrás para evitar romper frontend
  prodObj.precioFinal = prodObj.precioNormalFinal;

  return prodObj;
};

const getProductos = async (req, res) => {
  try {
    const { marca, familia, nombre } = req.query;
    let query = {};

    if (marca) query.marca = marca;
    if (familia) query.familia = familia;
    if (nombre) query.nombre = { $regex: nombre, $options: 'i' };

    const productos = await Producto.find(query)
      .populate('marca', 'nombre')
      .populate('familia', 'nombre');
      
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

const getProductoById = async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await Producto.findById(id)
      .populate('marca', 'nombre')
      .populate('familia', 'nombre');
    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const hoy = new Date();
    const ofertasActivas = await Oferta.find({
      activo: true,
      fechaInicio: { $lte: hoy },
      fechaFin: { $gte: hoy }
    });

    res.json(aplicarOfertaAProducto(producto, ofertasActivas));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener el producto" });
  }
};

const createProducto = async (req, res) => {
  try {
    const { 
      nombre, descripcion, precioNormal, skuNormal, precioMayoreo, skuMayoreo, precioCaja, skuCaja, stock, marca, familia, activo, imagenUrl
    } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: "Nombre es obligatorio" });
    }

    let finalSkuNormal = skuNormal;
    let finalSkuMayoreo = skuMayoreo;
    let finalSkuCaja = skuCaja;

    if (!finalSkuNormal && marca && familia) {
      const gSkus = await generarSkusAutomaticos({ marca, familia });
      if (gSkus) {
        finalSkuNormal = gSkus.skuNormal;
        finalSkuMayoreo = skuMayoreo || gSkus.skuMayoreo;
        finalSkuCaja = skuCaja || gSkus.skuCaja;
      }
    }

    const nuevoProducto = new Producto({
      nombre, descripcion, precioNormal, skuNormal: finalSkuNormal, precioMayoreo, skuMayoreo: finalSkuMayoreo, precioCaja, skuCaja: finalSkuCaja, stock, marca, familia, activo, imagenUrl
    });

    await nuevoProducto.save();
    res.status(201).json({ mensaje: "Producto creado con éxito", producto: nuevoProducto });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear el producto" });
  }
};

const updateProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const productoActual = await Producto.findById(id);
    if (!productoActual) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    // Proteger SKUs existentes
    updateData.skuNormal = updateData.skuNormal || productoActual.skuNormal;
    updateData.skuMayoreo = updateData.skuMayoreo || productoActual.skuMayoreo;
    updateData.skuCaja = updateData.skuCaja || productoActual.skuCaja;

    // Generar SKUs si siguen vacíos
    if (!updateData.skuNormal && updateData.marca && updateData.familia) {
      const gSkus = await generarSkusAutomaticos(updateData);
      if (gSkus) {
        updateData.skuNormal = gSkus.skuNormal;
        updateData.skuMayoreo = updateData.skuMayoreo || gSkus.skuMayoreo;
        updateData.skuCaja = updateData.skuCaja || gSkus.skuCaja;
      }
    }

    const producto = await Producto.findByIdAndUpdate(id, updateData, { new: true });
    res.json({ mensaje: "Producto actualizado", producto });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar el producto" });
  }
};

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

const exportarProductosExcel = async (req, res) => {
  try {
    const productos = await Producto.find().populate('marca', 'nombre').populate('familia', 'nombre');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Productos');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 25 },
      { header: 'Nombre', key: 'nombre', width: 30 },
      { header: 'Descripción', key: 'descripcion', width: 40 },
      { header: 'Precio Normal', key: 'precioNormal', width: 15 },
      { header: 'SKU Normal', key: 'skuNormal', width: 20 },
      { header: 'Precio Mayoreo', key: 'precioMayoreo', width: 15 },
      { header: 'SKU Mayoreo', key: 'skuMayoreo', width: 20 },
      { header: 'Precio Caja', key: 'precioCaja', width: 15 },
      { header: 'SKU Caja', key: 'skuCaja', width: 20 },
      { header: 'Stock', key: 'stock', width: 10 },
      { header: 'Marca', key: 'marca', width: 20 },
      { header: 'Familia', key: 'familia', width: 20 },
      { header: 'Activo', key: 'activo', width: 10 },
      { header: 'Imagen URL', key: 'imagenUrl', width: 50 }
    ];

    productos.forEach(prod => {
      worksheet.addRow({
        id: prod._id.toString(),
        nombre: prod.nombre,
        descripcion: prod.descripcion || '',
        precioNormal: prod.precioNormal || 0,
        skuNormal: prod.skuNormal || '',
        precioMayoreo: prod.precioMayoreo || 0,
        skuMayoreo: prod.skuMayoreo || '',
        precioCaja: prod.precioCaja || 0,
        skuCaja: prod.skuCaja || '',
        stock: prod.stock || 0,
        marca: prod.marca?.nombre || '',
        familia: prod.familia?.nombre || '',
        activo: prod.activo ? 'Sí' : 'No',
        imagenUrl: prod.imagenUrl || ''
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

const parseFloatSeguro = (valor) => {
  if (valor === null || valor === undefined || valor === '') return 0;
  const parsed = Number.parseFloat(valor.toString().replaceAll(',', ''));
  return Number.isNaN(parsed) ? 0 : parsed;
};

const parseIntSeguro = (valor) => {
  if (valor === null || valor === undefined || valor === '') return 0;
  const parsed = Number.parseInt(valor.toString().replaceAll(',', ''), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const generarSkusAutomaticos = async (data) => {
  const marcaId = data.marca?._id || data.marca;
  const familiaId = data.familia?._id || data.familia;

  if (!marcaId || !familiaId) return null;

  const [marcaDoc, familiaDoc] = await Promise.all([
    Marca.findById(marcaId),
    Familia.findById(familiaId)
  ]);

  if (!marcaDoc || !familiaDoc) return null;

  const prefijoM = marcaDoc.nombre.substring(0, 3).toUpperCase().replaceAll(/[^A-Z]/g, 'X').padEnd(3, 'X');
  const prefijoF = familiaDoc.nombre.substring(0, 3).toUpperCase().replaceAll(/[^A-Z]/g, 'X').padEnd(3, 'X');
  
  const count = await Producto.countDocuments({ familia: familiaId });
  const correlativo = String(count + 1).padStart(3, '0');

  return {
    skuNormal: `${prefijoM}-${prefijoF}-${correlativo}-N`,
    skuMayoreo: `${prefijoM}-${prefijoF}-${correlativo}-M`,
    skuCaja: `${prefijoM}-${prefijoF}-${correlativo}-C`
  };
};

const procesarFilaExcel = async (row, index, resumen) => {
  if (!row.hasValues) return;

  const id = row.getCell(1).value;
  const nombre = row.getCell(2).value;
  const descripcion = row.getCell(3).value;
  const precioNormal = row.getCell(4).value;
  const skuNormal = row.getCell(5).value;
  const precioMayoreo = row.getCell(6).value;
  const skuMayoreo = row.getCell(7).value;
  const precioCaja = row.getCell(8).value;
  const skuCaja = row.getCell(9).value;
  const stock = row.getCell(10).value;
  const marcaNombre = row.getCell(11).value;
  const familiaNombre = row.getCell(12).value;
  const activoTexto = row.getCell(13).value;
  const imagenUrl = row.getCell(14).value;

  try {
    if (!nombre) {
      throw new Error("El nombre es obligatorio");
    }

    // 1. Resolver o CREAR Marca por nombre
    let marcaId = null;
    if (marcaNombre) {
      const nombreLimpio = String(marcaNombre).trim();
      let marcaDoc = await Marca.findOne({ nombre: { $regex: new RegExp(`^${nombreLimpio}$`, 'i') } });
      
      if (!marcaDoc) {
        // CREACIÓN AUTOMÁTICA DE MARCA
        marcaDoc = new Marca({ nombre: nombreLimpio });
        await marcaDoc.save();
      }
      marcaId = marcaDoc._id;
    }

    // 2. Resolver o CREAR Familia por nombre
    let familiaId = null;
    if (familiaNombre) {
      const nombreLimpioF = String(familiaNombre).trim();
      // Buscamos la familia que coincida con el nombre Y con la marca (pueden haber familias con mismo nombre en marcas distintas)
      let familiaDoc = await Familia.findOne({ 
        nombre: { $regex: new RegExp(`^${nombreLimpioF}$`, 'i') },
        marca: marcaId 
      });

      if (!familiaDoc) {
        if (!marcaId) {
          throw new Error(`No se puede crear la familia '${nombreLimpioF}' porque no hay una marca definida en esta fila.`);
        }
        // CREACIÓN AUTOMÁTICA DE FAMILIA vinculada a la Marca
        familiaDoc = new Familia({ nombre: nombreLimpioF, marca: marcaId });
        await familiaDoc.save();
      }
      familiaId = familiaDoc._id;
    }

    const activoFlag = activoTexto?.toString().toLowerCase() === 'sí' || activoTexto?.toString().toLowerCase() === 'si' || activoTexto === true;

    let producto = null;
    if (id && String(id).length === 24) {
      producto = await Producto.findById(String(id));
    }

    if (!producto && skuNormal) {
      producto = await Producto.findOne({ skuNormal: String(skuNormal) });
    }

    if (producto) {
      // ACTUALIZAR PRODUCTO EXISTENTE
      producto.nombre = String(nombre || '');
      producto.descripcion = descripcion ? String(descripcion) : producto.descripcion;
      producto.precioNormal = parseFloatSeguro(precioNormal);
      producto.skuNormal = skuNormal ? String(skuNormal) : producto.skuNormal;
      producto.precioMayoreo = parseFloatSeguro(precioMayoreo);
      producto.skuMayoreo = skuMayoreo?.toString() ?? producto.skuMayoreo;
      producto.precioCaja = parseFloatSeguro(precioCaja);
      producto.skuCaja = skuCaja?.toString() ?? producto.skuCaja;
      producto.stock = parseIntSeguro(stock);
      producto.marca = marcaId || producto.marca;
      producto.familia = familiaId || producto.familia;
      producto.activo = activoFlag;
      producto.imagenUrl = imagenUrl?.toString() ?? producto.imagenUrl;
      
      await producto.save();
      resumen.actualizados++;
    } else {
      // CREAR PRODUCTO NUEVO
      let finalSkuN = skuNormal ? String(skuNormal) : '';
      let finalSkuM = skuMayoreo ? String(skuMayoreo) : '';
      let finalSkuC = skuCaja ? String(skuCaja) : '';

      // Si no hay SKUs y tenemos marca/familia, generarlos
      if (!finalSkuN && marcaId && familiaId) {
        const autoSkus = await generarSkusAutomaticos({ marca: marcaId, familia: familiaId });
        if (autoSkus) {
          finalSkuN = autoSkus.skuNormal;
          finalSkuM = autoSkus.skuMayoreo;
          finalSkuC = autoSkus.skuCaja;
        }
      }

      const nuevoProd = new Producto({
        nombre: String(nombre || ''),
        descripcion: descripcion ? String(descripcion) : '',
        precioNormal: parseFloatSeguro(precioNormal),
        skuNormal: finalSkuN,
        precioMayoreo: parseFloatSeguro(precioMayoreo),
        skuMayoreo: finalSkuM,
        precioCaja: parseFloatSeguro(precioCaja),
        skuCaja: finalSkuC,
        stock: parseIntSeguro(stock),
        marca: marcaId,
        familia: familiaId,
        activo: activoFlag,
        imagenUrl: imagenUrl ? String(imagenUrl) : ''
      });
      await nuevoProd.save();
      resumen.creados++;
    }
  } catch (err) {
    resumen.errores++;
    resumen.detallesErrores.push(`Fila ${index}: ${err.message}`);
  }
};

const importarProductosExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se proporcionó ningún archivo" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      return res.status(400).json({ error: "El archivo Excel no tiene hojas válidas" });
    }
    
    const resumen = { creados: 0, actualizados: 0, errores: 0, detallesErrores: [] };

    for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        await procesarFilaExcel(row, i, resumen);
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
