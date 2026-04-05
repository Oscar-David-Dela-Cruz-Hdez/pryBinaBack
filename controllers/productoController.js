const Producto = require('../models/Producto');
const Oferta = require('../models/Oferta');
const ExcelJS = require('exceljs');

const aplicarOfertaAProducto = (producto, ofertasActivas) => {
  let ofertaAplicable = ofertasActivas.find(o => 
    o.productos.some(id => id.toString() === producto._id.toString())
  );

  if (!ofertaAplicable && producto.marca) {
    const marcaId = producto.marca._id ? producto.marca._id.toString() : producto.marca.toString();
    ofertaAplicable = ofertasActivas.find(o => 
      o.marcas && o.marcas.some(id => id.toString() === marcaId)
    );
  }

  const prodObj = producto.toObject ? producto.toObject() : producto;

  if (ofertaAplicable && prodObj.precioNormal) {
    prodObj.ofertaAplicada = {
      nombre: ofertaAplicable.nombre,
      tipoDescuento: ofertaAplicable.tipoDescuento,
      valorDescuento: ofertaAplicable.valorDescuento
    };

    if (ofertaAplicable.tipoDescuento === 'porcentaje') {
      const descuentoNormal = prodObj.precioNormal * (ofertaAplicable.valorDescuento / 100);
      prodObj.precioNormalFinal = Math.max(0, prodObj.precioNormal - descuentoNormal);
      if (prodObj.precioMayoreo) {
        const descuentoMayoreo = prodObj.precioMayoreo * (ofertaAplicable.valorDescuento / 100);
        prodObj.precioMayoreoFinal = Math.max(0, prodObj.precioMayoreo - descuentoMayoreo);
      }
      if (prodObj.precioCaja) {
        const descuentoCaja = prodObj.precioCaja * (ofertaAplicable.valorDescuento / 100);
        prodObj.precioCajaFinal = Math.max(0, prodObj.precioCaja - descuentoCaja);
      }
    } else if (ofertaAplicable.tipoDescuento === 'monto_fijo') {
      prodObj.precioNormalFinal = Math.max(0, prodObj.precioNormal - ofertaAplicable.valorDescuento);
      if (prodObj.precioMayoreo) prodObj.precioMayoreoFinal = Math.max(0, prodObj.precioMayoreo - ofertaAplicable.valorDescuento);
      if (prodObj.precioCaja) prodObj.precioCajaFinal = Math.max(0, prodObj.precioCaja - ofertaAplicable.valorDescuento);
    }
  } else {
    prodObj.precioNormalFinal = prodObj.precioNormal;
    prodObj.precioMayoreoFinal = prodObj.precioMayoreo;
    prodObj.precioCajaFinal = prodObj.precioCaja;
  }
  
  // Compatibilidad hacia atrás para evitar romper frontend que usa precioFinal
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

    const nuevoProducto = new Producto({
      nombre, descripcion, precioNormal, skuNormal, precioMayoreo, skuMayoreo, precioCaja, skuCaja, stock, marca, familia, activo, imagenUrl
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
    const { 
        nombre, descripcion, precioNormal, skuNormal, precioMayoreo, skuMayoreo, precioCaja, skuCaja, stock, marca, familia, activo, imagenUrl
    } = req.body;

    const producto = await Producto.findByIdAndUpdate(
      id,
      { nombre, descripcion, precioNormal, skuNormal, precioMayoreo, skuMayoreo, precioCaja, skuCaja, stock, marca, familia, activo, imagenUrl },
      { new: true }
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
      { header: 'Activo', key: 'activo', width: 10 }
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
        marca: prod.marca ? prod.marca.nombre : '',
        familia: prod.familia ? prod.familia.nombre : '',
        activo: prod.activo ? 'Sí' : 'No'
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
  const parsed = parseFloat(valor.toString().replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
};

const parseIntSeguro = (valor) => {
  if (valor === null || valor === undefined || valor === '') return 0;
  const parsed = parseInt(valor.toString().replace(/,/g, ''), 10);
  return isNaN(parsed) ? 0 : parsed;
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

  try {
    if (!nombre) {
      throw new Error("El nombre es obligatorio");
    }

    let producto = null;
    if (id && id.toString().length === 24) {
      producto = await Producto.findById(id.toString());
    }

    if (!producto && skuNormal) {
      producto = await Producto.findOne({ skuNormal: skuNormal.toString() });
    }

    if (producto) {
      producto.nombre = nombre.toString();
      if (descripcion !== null && descripcion !== undefined) producto.descripcion = descripcion.toString();
      producto.precioNormal = parseFloatSeguro(precioNormal);
      if (skuNormal) producto.skuNormal = skuNormal.toString();
      producto.precioMayoreo = parseFloatSeguro(precioMayoreo);
      if (skuMayoreo) producto.skuMayoreo = skuMayoreo.toString();
      producto.precioCaja = parseFloatSeguro(precioCaja);
      if (skuCaja) producto.skuCaja = skuCaja.toString();
      producto.stock = parseIntSeguro(stock);
      
      await producto.save();
      resumen.actualizados++;
    } else {
      const nuevoProd = new Producto({
        nombre: nombre.toString(),
        descripcion: descripcion ? descripcion.toString() : '',
        precioNormal: parseFloatSeguro(precioNormal),
        skuNormal: skuNormal ? skuNormal.toString() : '',
        precioMayoreo: parseFloatSeguro(precioMayoreo),
        skuMayoreo: skuMayoreo ? skuMayoreo.toString() : '',
        precioCaja: parseFloatSeguro(precioCaja),
        skuCaja: skuCaja ? skuCaja.toString() : '',
        stock: parseIntSeguro(stock),
        activo: true
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
