const Pedido = require("../models/Pedido");
const Producto = require("../models/Producto");
const filterXSS = require('xss');

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

            total += productoDb.precio * item.cantidad;
            productosValidados.push({
                producto: productoDb._id,
                nombre: productoDb.nombre,
                cantidad: item.cantidad,
                precio: productoDb.precio
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
        const { rol, id } = req.user;
        let query = {};

        if (rol !== 'admin') {
            query.usuario = id;
        }

        const pedidos = await Pedido.find(query)
            .populate('usuario', 'nombre email')
            .sort({ createdAt: -1 });

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

module.exports = {
    createPedido,
    getPedidos,
    getPedidoById,
    updateEstadoPedido
};
