const Pedido = require("../models/Pedido");
const Producto = require("../models/Producto");
const ExcelJS = require('exceljs');
const filterXSS = require('xss');
const { cancelarPedidosVencidos } = require('../services/pedidoPendienteService');
const { obtenerRiesgosCancelacion } = require('../services/analiticaService');

// Crear Pedido (Cliente)
const createPedido = async (req, res) => {
    try {
        const { productos, direccionEnvio, metodoPago, costoEnvio } = req.body;
        const usuarioId = req.user.id; // Del token

        if (!productos || productos.length === 0) {
            return res.status(400).json({ error: "No hay productos en el pedido" });
        }

        let total = 0;
        const productosValidados = [];

        // Validar stock y calcular total real
        for (const item of productos) {
            const productoDb = await Producto.findById(item.producto);
            if (!productoDb) {
                return res.status(400).json({ error: `Producto no encontrado: ${item.producto}` });
            }

            if (productoDb.stock < item.cantidad) {
                return res.status(400).json({ error: `Stock insuficiente para ${productoDb.nombre}` });
            }

            // Restar stock
            productoDb.stock -= item.cantidad;
            await productoDb.save();

            total += productoDb.precioNormal * item.cantidad;
            productosValidados.push({
                producto: productoDb._id,
                nombre: productoDb.nombre,
                cantidad: item.cantidad,
                precio: productoDb.precioNormal
            });
        }

        total += (costoEnvio || 0);

        const nuevoPedido = new Pedido({
            usuario: usuarioId,
            productos: productosValidados,
            total,
            direccionEnvio, // Se asume validado en frontend, podria sanitizarse aqui
            metodoPago,
            costoEnvio: costoEnvio || 0
        });

        await nuevoPedido.save();
        res.status(201).json({ mensaje: "Pedido creado con éxito", pedido: nuevoPedido });

    } catch (error) {
        console.error("Error al crear pedido:", error);
        res.status(500).json({ error: "Error al procesar el pedido" });
    }
};

// Obtener Pedidos (Admin: Todos, Usuario: Suyos)
const getPedidos = async (req, res) => {
    try {
        await cancelarPedidosVencidos();
        const { rol, id } = req.user;
        let query = {};

        if (rol !== 'admin') {
            query.usuario = id;
        }

        const limiteSolicitado = Number.parseInt(req.query.limite, 10);
        const limite = Number.isFinite(limiteSolicitado) ? Math.min(Math.max(limiteSolicitado, 1), 500) : 250;
        const pedidos = await Pedido.find(query)
            .populate('usuario', 'nombre email fechaNacimiento')
            .sort({ createdAt: -1 })
            .limit(limite)
            .lean();

        res.json(pedidos);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener pedidos" });
    }
};

// Obtener detalle pedido por ID
const getPedidoById = async (req, res) => {
    try {
        const { id } = req.params;
        const pedido = await Pedido.findById(id).populate('usuario', 'nombre email');

        if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

        // Seguridad: Solo admin o dueño del pedido
        if (req.user.rol !== 'admin' && pedido.usuario._id.toString() !== req.user.id) {
            return res.status(403).json({ error: "No autorizado" });
        }

        res.json(pedido);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener el pedido" });
    }
};

// Actualizar Estado (Admin)
const updateEstadoPedido = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        const pedido = await Pedido.findByIdAndUpdate(id, { estado }, { new: true });

        if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

        res.json(pedido);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar estado" });
    }
};

const getAnaliticaRiesgo = async (_req, res) => {
    try {
        res.json(await obtenerRiesgosCancelacion());
    } catch (error) {
        console.error('Error al calcular riesgo de cancelación:', error);
        res.status(500).json({ error: 'Error al calcular riesgo de cancelación' });
    }
};

// Exportar Pedidos a Excel (Admin)
const exportarPedidosExcel = async (req, res) => {
    try {
        // Obtenemos todos los pedidos y los datos de quien lo compró
        const pedidos = await Pedido.find()
            .populate('usuario', 'nombre email')
            .sort({ createdAt: -1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Ventas');

        // Definimos las columnas del Excel
        worksheet.columns = [
            { header: 'ID Pedido', key: 'id', width: 25 },
            { header: 'Fecha', key: 'fecha', width: 20 },
            { header: 'Cliente (Nombre)', key: 'clienteNombre', width: 25 },
            { header: 'Cliente (Email)', key: 'clienteEmail', width: 30 },
            { header: 'Total Gastado ($)', key: 'total', width: 15 },
            { header: 'Costo Envío ($)', key: 'envio', width: 15 },
            { header: 'Método de Pago', key: 'metodoPago', width: 15 },
            { header: 'Estado', key: 'estado', width: 15 },
            { header: 'Resumen de Productos', key: 'productos', width: 50 }
        ];

        // Llenamos las filas
        pedidos.forEach(pedido => {
            // Creamos un texto resumen de lo que compró: "2x Shampoo, 1x Acondicionador"
            const productosTexto = pedido.productos.map(p => `${p.cantidad}x ${p.nombre || 'Producto'}`).join(', ');

            // Formatear la fecha para que sea legible
            const fechaFormateada = pedido.createdAt ? new Date(pedido.createdAt).toLocaleDateString('es-MX', {
                 year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : 'S/F';

            worksheet.addRow({
                id: pedido._id.toString(),
                fecha: fechaFormateada,
                clienteNombre: pedido.usuario ? pedido.usuario.nombre : 'Usuario Eliminado',
                clienteEmail: pedido.usuario ? pedido.usuario.email : 'S/E',
                total: pedido.total,
                envio: pedido.costoEnvio,
                metodoPago: pedido.metodoPago,
                estado: pedido.estado,
                productos: productosTexto
            });
        });

        // Configurar los headers de respuesta para que inicie la descarga
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=reporte_pedidos.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error al exportar pedidos:', error);
        res.status(500).json({ error: "Error al exportar pedidos a Excel" });
    }
};

module.exports = {
    createPedido,
    getPedidos,
    getPedidoById,
    updateEstadoPedido,
    exportarPedidosExcel,
    getAnaliticaRiesgo
};
