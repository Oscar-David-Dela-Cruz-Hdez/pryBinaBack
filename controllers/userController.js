/*Login con RS256 y corrección de Perfil */
const filterXSS = require('xss');

const Usuario = require("../models/Usuario");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const SibApiV3Sdk = require("sib-api-v3-sdk");
const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto");

const client = new OAuth2Client();
let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

// Evita que se guarden datos vacíos o que el código truene si algo falta
const limpiarDato = (dato) => {
  if (dato === undefined || dato === null) return undefined;
  const strDato = String(dato).trim();
  if (strDato === "") return undefined;
  return filterXSS(strDato);
};

const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    const usuario = await Usuario.findById(userId);

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (usuario.password && currentPassword) {
      const esValida = await bcrypt.compare(currentPassword, usuario.password);
      if (!esValida) {
        return res.status(400).json({ error: "Contraseña actual incorrecta" });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    usuario.password = hashedPassword;
    await usuario.save();

    res.status(200).json({ mensaje: "Contraseña actualizada con éxito" });
  } catch (error) {
    console.error("Error al actualizar contraseña:", error);
    res.status(500).json({ error: "Error al actualizar la contraseña" });
  }
};

const updateSecret = async (req, res) => {
  try {
    const { preguntaSecreta, respuestaSecreta } = req.body;
    const userId = req.user.id;
    const usuario = await Usuario.findById(userId);

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const hashedRespuestaSecreta = await bcrypt.hash(respuestaSecreta, 10);
    usuario.preguntaSecreta = preguntaSecreta;
    usuario.respuestaSecreta = hashedRespuestaSecreta;
    await usuario.save();

    res.status(200).json({ mensaje: "Pregunta y respuesta secreta actualizadas con éxito" });
  } catch (error) {
    console.error("Error al actualizar pregunta/respuesta secreta:", error);
    res.status(500).json({ error: "Error al actualizar la pregunta/respuesta secreta" });
  }
};

const registerUser = async (req, res) => {
  try {
    const { fechaNacimiento, email, telefono, nombre, ap, am, password, preguntaSecreta, respuestaSecreta } = req.body;
    
    // Sanitizamos los datos
    const safeEmail = limpiarDato(email);
    const safePhone = limpiarDato(telefono);
    const safeNombre = limpiarDato(nombre);

    const fechaNacimientoNormalizada = fechaNacimientoValida(fechaNacimiento);
    if (!safeEmail) return res.status(400).json({ error: "El correo es obligatorio" });
    if (!fechaNacimientoNormalizada) return res.status(400).json({ error: "La fecha de nacimiento es obligatoria y debe ser válida" });

    // Validaciones
    const existingEmail = await Usuario.findOne({ email: safeEmail });
    if (existingEmail) return res.status(400).json({ error: "El correo electrónico ya está registrado" });
    
    if (safePhone) {
        const existingTelefono = await Usuario.findOne({ telefono: safePhone });
        if (existingTelefono) return res.status(400).json({ error: "El número de teléfono ya está registrado" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const respSecreta = await bcrypt.hash(respuestaSecreta, 10);

    const nuevoUsuario = new Usuario({
      nombre: safeNombre,
      ap: limpiarDato(ap),
      am: limpiarDato(am),
      fechaNacimiento: fechaNacimientoNormalizada,
      email: safeEmail,
      password: hashedPassword,
      telefono: safePhone,
      preguntaSecreta,
      respuestaSecreta: respSecreta,
    });

    await nuevoUsuario.save();
    res.status(201).json({ mensaje: "Usuario registrado con éxito", usuario: nuevoUsuario });
  } catch (error) {
    console.error("Error en registerUser:", error);

    if (error?.code === 11000) {
      const campoDuplicado = Object.keys(error.keyPattern || error.keyValue || {})[0];
      const mensajes = {
        email: "El correo electrónico ya está registrado",
        telefono: "El número de teléfono ya está registrado",
      };

      return res.status(409).json({
        error: mensajes[campoDuplicado] || "Ya existe un usuario con esos datos",
      });
    }

    if (error?.name === "ValidationError") {
      const primerError = Object.values(error.errors || {})[0];
      return res.status(400).json({
        error: primerError?.message || "Los datos del usuario no son válidos",
      });
    }

    res.status(500).json({ error: "Error al registrar usuario" });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip;
  const key = `${email}:${ip}`;

  if (!req.loginAttempts[key]) {
    req.loginAttempts[key] = { attempts: 0, lastAttempt: Date.now(), blockedUntil: 0 };
  }

  if (req.loginAttempts[key].blockedUntil > Date.now()) {
    const remainingTime = Math.ceil((req.loginAttempts[key].blockedUntil - Date.now()) / 60000);
    return res.status(429).json({ error: `Demasiados intentos fallidos. Intenta de nuevo en ${remainingTime} minutos.` });
  }

  try {
    const safeEmail = limpiarDato(email);
    if (!safeEmail) return res.status(400).json({ error: "Credenciales incorrectas" });

    const usuario = await Usuario.findOne({ email: safeEmail });
    
    let esValida = false;
    if (usuario) {
        esValida = await bcrypt.compare(password, usuario.password);
    }

    if (!usuario || !esValida) {
      req.loginAttempts[key].attempts += 1;
      if (req.loginAttempts[key].attempts >= 3) {
        req.loginAttempts[key].blockedUntil = Date.now() + 30 * 60 * 1000;
      }
      req.loginAttempts[key].lastAttempt = Date.now();
      return res.status(400).json({ error: "Credenciales incorrectas" });
    }

    req.loginAttempts[key].attempts = 0;
    req.loginAttempts[key].blockedUntil = 0;

    const codigo2FA = Math.floor(100000 + Math.random() * 900000).toString();
    usuario.loginCode = codigo2FA;
    usuario.loginCodeExpires = Date.now() + 10 * 60 * 1000;
    
    // Aseguramos que el array exista
    if (!usuario.activeTokens) usuario.activeTokens = [];
    
    await usuario.save();

    let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.to = [{ email: usuario.email, name: usuario.nombre }];
    sendSmtpEmail.sender = { name: "Distribuidora Panamericana", email: "delacruzhernandezoscardavid@gmail.com" };
    sendSmtpEmail.subject = "Tu Código de Inicio de Sesión";
    sendSmtpEmail.htmlContent = `<strong>Hola ${usuario.nombre},<br>Tu código de seguridad es: ${codigo2FA}</strong><br>Expira en 10 minutos.`;
    
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    res.status(200).json({ mensaje: "Código de seguridad enviado a tu correo" });

  } catch (error) {
    console.error("Error en loginUser:", error);
    res.status(500).json({ error: "Error en el servidor al enviar el código" });
  }
};

const verifyLoginCode = async (req, res) => {
  const { email, code } = req.body;
  try {
    const safeEmail = limpiarDato(email);
    const usuario = await Usuario.findOne({ email: safeEmail });
    
    if (!usuario) return res.status(400).json({ error: "Usuario no encontrado" });
    if (usuario.loginCode !== code) return res.status(400).json({ error: "Código incorrecto" });
    if (Date.now() > usuario.loginCodeExpires) return res.status(400).json({ error: "El código ha expirado" });

    // Generamos token seguro con RS256
    const token = jwt.sign(
      { id: usuario._id, rol: usuario.rol },
      req.privateKey,
      { expiresIn: "1h", algorithm: "RS256" }
    );

    if (!usuario.activeTokens) usuario.activeTokens = [];
    usuario.activeTokens.push(token);
    
    usuario.loginCode = undefined;
    usuario.loginCodeExpires = undefined;
    
    await usuario.save();

    res.json({ token, rol: usuario.rol, nombre: usuario.nombre });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Error al verificar el código" });
  }
};

const getUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.find({}, { password: 0 });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los usuarios" });
  }
};

const updateRol = async (req, res) => {
  try {
    const { id } = req.params;
    const { rol } = req.body;
    const usuarioActualizado = await Usuario.findByIdAndUpdate(id, { rol }, { new: true });
    if (!usuarioActualizado) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(usuarioActualizado);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar el rol" });
  }
};

const generarAlexaTokenPlano = () => crypto.randomInt(10000, 100000).toString();

const getAlexaAdmins = async (req, res) => {
  try {
    const admins = await Usuario.find({ rol: "admin" })
      .select("nombre ap am email fechaNacimiento rol alexaTokenLast4 alexaTokenUpdatedAt")
      .sort({ nombre: 1, email: 1 });
    res.json(admins);
  } catch (error) {
    console.error("Error al obtener administradores Alexa:", error);
    res.status(500).json({ error: "Error al obtener administradores Alexa" });
  }
};

const generateAlexaToken = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findById(id);

    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
    if (usuario.rol !== "admin") {
      return res.status(400).json({ error: "Solo los administradores pueden tener token de Alexa" });
    }

    const tokenAlexa = generarAlexaTokenPlano();
    usuario.alexaTokenHash = await bcrypt.hash(tokenAlexa, 10);
    usuario.alexaTokenLast4 = tokenAlexa.slice(-4);
    usuario.alexaTokenUpdatedAt = new Date();
    await usuario.save();

    res.json({
      mensaje: "Token de Alexa generado correctamente",
      tokenAlexa,
      usuario: {
        _id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        alexaTokenLast4: usuario.alexaTokenLast4,
        alexaTokenUpdatedAt: usuario.alexaTokenUpdatedAt
      }
    });
  } catch (error) {
    console.error("Error al generar token de Alexa:", error);
    res.status(500).json({ error: "Error al generar token de Alexa" });
  }
};

const revokeAlexaToken = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findById(id);

    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });

    usuario.alexaTokenHash = undefined;
    usuario.alexaTokenLast4 = undefined;
    usuario.alexaTokenUpdatedAt = undefined;
    await usuario.save();

    res.json({ mensaje: "Token de Alexa revocado correctamente" });
  } catch (error) {
    console.error("Error al revocar token de Alexa:", error);
    res.status(500).json({ error: "Error al revocar token de Alexa" });
  }
};

const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    await Usuario.findByIdAndDelete(id);
    res.json({ mensaje: "Usuario eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar el usuario" });
  }
};

const verificarCorreo = async (req, res) => {
  res.status(200).json({ mensaje: "Si el correo existe, se envió el mensaje." });
};

const preguntas = {
  "personaje-favorito": "¿Cuál es tu personaje favorito?",
  "pelicula-favorita": "¿Cuál es tu película favorita?",
  "mejor-amigo": "¿Quién es tu mejor amigo?",
  "nombre-mascota": "¿Cuál es el nombre de tu mascota?",
  "deporte-favorito": "¿Cuál es tu deporte favorito?",
};

const obtenerPregunta = async (req, res) => {
  try {
    const { email } = req.body;
    const usuario = await Usuario.findOne({ email: limpiarDato(email) });
    if (!usuario) return res.status(404).json({ error: "Correo no encontrado" });

    const preguntaCompleta = preguntas[usuario.preguntaSecreta];
    if (!preguntaCompleta) return res.status(400).json({ error: "Pregunta no configurada" });

    res.status(200).json({ preguntaSecreta: preguntaCompleta });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener la pregunta" });
  }
};

const verificarRespuesta = async (req, res) => {
  const { email, respuesta } = req.body;
  try {
    const usuario = await Usuario.findOne({ email: limpiarDato(email) });
    if (!usuario) return res.status(404).json({ error: "Correo no encontrado" });
    
    const esValida = await bcrypt.compare(respuesta, usuario.respuestaSecreta);
    if (!esValida) return res.status(400).json({ error: "Respuesta incorrecta" });
    
    res.status(200).json({ mensaje: "Respuesta correcta" });
  } catch (error) {
    res.status(500).json({ error: "Error al verificar respuesta" });
  }
};

const cambiarContrasena = async (req, res) => {
  const { email, nuevaPassword } = req.body;
  try {
    const usuario = await Usuario.findOne({ email: limpiarDato(email) });
    if (!usuario) return res.status(404).json({ error: "Correo no encontrado" });
    
    usuario.password = await bcrypt.hash(nuevaPassword, 10);
    await usuario.save();
    res.status(200).json({ mensaje: "Contraseña cambiada con éxito" });
  } catch (error) {
    res.status(500).json({ error: "Error al cambiar contraseña" });
  }
};

const getMiPerfil = async (req, res) => {
  try {
    // Aquí NO sanitizamos nada al leer, solo devolvemos los datos
    const usuario = await Usuario.findById(req.user.id).select("-password -respuestaSecreta");
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(usuario);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener perfil" });
  }
};

const updateMiPerfil = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fechaNacimiento, email } = req.body;
    const safeEmail = limpiarDato(email);
    const fechaNacimientoNormalizada = fechaNacimiento === undefined ? undefined : fechaNacimientoValida(fechaNacimiento);

    // 1. Validar duplicados de forma plana
    if (safeEmail && await Usuario.findOne({ email: safeEmail, _id: { $ne: userId } })) {
      return res.status(400).json({ error: "Ese email ya está en uso" });
    }

    // 2. Construcción Dinámica Compacta (Reduce Complejidad Cognitiva)
    const camposAActualizar = {};
    const camposParaProcesar = ['nombre', 'ap', 'am', 'telefono'];

    camposParaProcesar.forEach(campo => {
      const valorLimpio = req.body[campo] === undefined ? undefined : limpiarDato(req.body[campo]);
      if (valorLimpio !== undefined) camposAActualizar[campo] = valorLimpio;
    });

    // Casos especiales (ya sanitizados arriba)
    if (fechaNacimiento !== undefined) {
      if (!fechaNacimientoNormalizada) return res.status(400).json({ error: "La fecha de nacimiento no es válida" });
      camposAActualizar.fechaNacimiento = fechaNacimientoNormalizada;
    }
    if (email !== undefined && safeEmail !== undefined) camposAActualizar.email = safeEmail;

    const usuarioActualizado = await Usuario.findByIdAndUpdate(
      userId,
      { $set: camposAActualizar },
      { new: true, runValidators: true }
    ).select("-password");

    res.json(usuarioActualizado);
  } catch (error) {
    console.error("Error al actualizar perfil:", error);
    res.status(500).json({ error: "Error al actualizar perfil" });
  }
};

const fechaNacimientoValida = (valor) => {
  if (!valor) return null;
  const fecha = new Date(valor);
  const minima = new Date('1900-01-01T00:00:00.000Z');
  const hoy = new Date();
  if (Number.isNaN(fecha.getTime()) || fecha < minima || fecha > hoy) return null;
  return fecha;
};

const limpiarDireccion = (body) => ({
  alias: limpiarDato(body.alias),
  calle: limpiarDato(body.calle),
  colonia: limpiarDato(body.colonia),
  ciudad: limpiarDato(body.ciudad),
  estado: limpiarDato(body.estado),
  cp: limpiarDato(body.cp),
  telefono: limpiarDato(body.telefono),
  referencias: limpiarDato(body.referencias)
});

const direccionValida = (direccion) =>
  direccion.alias && direccion.calle && direccion.ciudad && direccion.estado && direccion.cp && direccion.telefono;

const getDirecciones = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user.id).select('direcciones');
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(usuario.direcciones);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener direcciones' });
  }
};

const createDireccion = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (usuario.direcciones.length >= 10) return res.status(400).json({ error: 'Puedes guardar un máximo de 10 direcciones' });

    const direccion = limpiarDireccion(req.body);
    if (!direccionValida(direccion)) return res.status(400).json({ error: 'Completa los campos obligatorios de la dirección' });
    if (usuario.direcciones.length === 0 || req.body.predeterminada === true) {
      usuario.direcciones.forEach(item => item.predeterminada = false);
      direccion.predeterminada = true;
    }
    usuario.direcciones.push(direccion);
    await usuario.save();
    res.status(201).json(usuario.direcciones[usuario.direcciones.length - 1]);
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar la dirección' });
  }
};

const updateDireccion = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    const direccion = usuario.direcciones.id(req.params.direccionId);
    if (!direccion) return res.status(404).json({ error: 'Dirección no encontrada' });
    const datos = limpiarDireccion(req.body);
    if (!direccionValida(datos)) return res.status(400).json({ error: 'Completa los campos obligatorios de la dirección' });
    Object.assign(direccion, datos);
    await usuario.save();
    res.json(direccion);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar la dirección' });
  }
};

const deleteDireccion = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    const direccion = usuario.direcciones.id(req.params.direccionId);
    if (!direccion) return res.status(404).json({ error: 'Dirección no encontrada' });
    const eraPredeterminada = direccion.predeterminada;
    direccion.deleteOne();
    if (eraPredeterminada && usuario.direcciones.length) usuario.direcciones[0].predeterminada = true;
    await usuario.save();
    res.json({ mensaje: 'Dirección eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la dirección' });
  }
};

const setDireccionPredeterminada = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    const direccion = usuario.direcciones.id(req.params.direccionId);
    if (!direccion) return res.status(404).json({ error: 'Dirección no encontrada' });
    usuario.direcciones.forEach(item => item.predeterminada = item._id.equals(direccion._id));
    await usuario.save();
    res.json(usuario.direcciones);
  } catch (error) {
    res.status(500).json({ error: 'Error al establecer la dirección predeterminada' });
  }
};

// --- CORRECCIÓN CRÍTICA PARA EL LOGIN DE GOOGLE ---
// Aquí estaba el error principal: usabas "secreto" en lugar de la llave privada
const googleLogin = async (req, res) => {
  console.log("👉 INICIO LOGIN GOOGLE");
  const { idToken } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: "610797077240-hd26f06tg0k68v7hhtuoi5fdl76a50rf.apps.googleusercontent.com",
    });

    const payload = ticket.getPayload();
    const { email, name } = payload;

    let usuario = await Usuario.findOne({ email: email });

    if (!usuario) {
      usuario = new Usuario({
        nombre: name,
        email: email,
        rol: "usuario",
      });
      await usuario.save();
    }

    // AHORA SÍ: Usamos RS256 para que el Middleware lo acepte
    const token = jwt.sign(
        { id: usuario._id, rol: usuario.rol }, 
        req.privateKey, 
        { expiresIn: "1h", algorithm: "RS256" }
    );
    
    // Y guardamos el token en la base de datos para que el acceso sea válido
    if (!usuario.activeTokens) usuario.activeTokens = [];
    usuario.activeTokens.push(token);
    await usuario.save();

    res.json({ token, rol: usuario.rol, nombre: usuario.nombre });
  } catch (error) {
    console.error("Error en googleLogin:", error.message);
    res.status(401).json({ error: "Token de Google inválido" });
  }
};

const checkUsername = async (req, res) => {
  const safe = limpiarDato(req.body.username);
  if (!safe) return res.json({ available: true });
  const existing = await Usuario.findOne({ username: safe });
  res.json({ available: !existing });
};
const checkEmail = async (req, res) => {
  const safe = limpiarDato(req.body.email);
  if (!safe) return res.json({ available: true });
  const existing = await Usuario.findOne({ email: safe });
  res.json({ available: !existing });
};
const checkPhone = async (req, res) => {
  const safe = limpiarDato(req.body.telefono);
  if (!safe) return res.json({ available: true });
  const existing = await Usuario.findOne({ telefono: safe });
  res.json({ available: !existing });
};

module.exports = {
  registerUser, loginUser, googleLogin, verifyLoginCode, getUsuarios, updateRol,
  deleteUsuario, verificarCorreo, obtenerPregunta, verificarRespuesta, cambiarContrasena,
  getMiPerfil, updateMiPerfil, updatePassword, updateSecret, checkUsername, checkEmail, checkPhone,
  getAlexaAdmins, generateAlexaToken, revokeAlexaToken,
  getDirecciones, createDireccion, updateDireccion, deleteDireccion, setDireccionPredeterminada
};
