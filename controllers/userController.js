const Usuario = require("../models/Usuario");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SibApiV3Sdk = require("sib-api-v3-sdk");

const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(); 
let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;
// ------------------------------------

// Registrar un nuevo usuario 
const registerUser = async (req, res) => {
  try {
    const { username, email, telefono } = req.body;

    const existingUsername = await Usuario.findOne({ username });
    if (existingUsername) {
      return res
        .status(400)
        .json({ error: "El nombre de usuario ya está en uso" });
    }

    const existingEmail = await Usuario.findOne({ email });
    if (existingEmail) {
      return res
        .status(400)
        .json({ error: "El correo electrónico ya está registrado" });
    }

    const existingTelefono = await Usuario.findOne({ telefono });
    if (existingTelefono) {
      return res
        .status(400)
        .json({ error: "El número de teléfono ya está registrado" });
    }

    const { nombre, ap, am, password, preguntaSecreta, respuestaSecreta } =
      req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const respSecreta = await bcrypt.hash(respuestaSecreta, 10);

    const nuevoUsuario = new Usuario({
      nombre,
      ap,
      am,
      username,
      email,
      password: hashedPassword,
      telefono,
      preguntaSecreta,
      respuestaSecreta,
      respSecreta,
    });

    await nuevoUsuario.save();
    res
      .status(201)
      .json({ mensaje: "Usuario registrado con éxito", usuario: nuevoUsuario });
  } catch (error) {
    res.status(500).json({ error: "Error al registrar usuario" });
  }
};

// PASO 1: Login inicial y envío de código 2FA
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const usuario = await Usuario.findOne({ email });
    if (!usuario)
      return res.status(400).json({ error: "Usuario no encontrado" });

    const esValida = await bcrypt.compare(password, usuario.password);
    if (!esValida)
      return res.status(400).json({ error: "Contraseña incorrecta" });

    const codigo2FA = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = Date.now() + 10 * 60 * 1000; // 10 minutos


    usuario.loginCode = codigo2FA;
    usuario.loginCodeExpires = expiracion;
    await usuario.save();

    let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();


    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.to = [{ email: usuario.email, name: usuario.nombre }];
    sendSmtpEmail.sender = {
      name: "Distribuidora Panamericana", 
      email: "delacruzhernandezoscardavid@gmail.com", // El email en Brevo
    };
    sendSmtpEmail.subject = "Tu Código de Inicio de Sesión";
    sendSmtpEmail.htmlContent = `<strong>Hola ${usuario.nombre},<br>Tu código de seguridad es: ${codigo2FA}</strong><br>Expira en 10 minutos.`;


    await apiInstance.sendTransacEmail(sendSmtpEmail);

    res
      .status(200)
      .json({ mensaje: "Código de seguridad enviado a tu correo" });
  } catch (error) {
    console.error("Error en loginUser:", error); // Imprime el error completo
    res.status(500).json({ error: "Error en el servidor al enviar el código" });
  }
};

// PASO 2: Verifica el código 2FA y devuelve el Token
const verifyLoginCode = async (req, res) => {
  const { email, code } = req.body;

  try {
    const usuario = await Usuario.findOne({ email });

    if (!usuario) {
      return res.status(400).json({ error: "Usuario no encontrado" });
    }

    console.log("Comparando códigos 2FA:");
    console.log(
      "Código de la DB:",
      usuario.loginCode,
      "(Tipo:",
      typeof usuario.loginCode,
      ")"
    );
    console.log("Código del Usuario:", code, "(Tipo:", typeof code, ")");

    if (usuario.loginCode !== code) {
      return res.status(400).json({ error: "Código incorrecto" });
    }

    if (Date.now() > usuario.loginCodeExpires) {
      return res.status(400).json({ error: "El código ha expirado" });
    }

    // ¡Éxito! Limpiamos el código de la DB
    usuario.loginCode = undefined;
    usuario.loginCodeExpires = undefined;
    await usuario.save();

    // Y AHORA SÍ, creamos y enviamos el token
    const token = jwt.sign({ id: usuario._id, rol: usuario.rol }, "secreto", {
      expiresIn: "1h",
    });
    res.json({ token, rol: usuario.rol, nombre: usuario.nombre });
  } catch (error) {
    console.error(error.message);
    res
      .status(500)
      .json({ error: "Error en el servidor al verificar el código" });
  }
};

// Obtener todos los usuarios (solo para administradores)
const getUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.find({}, { password: 0 }); // Excluir la contraseña
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los usuarios" });
  }
};

// Actualizar el rol de un usuario (solo para administradores)
const updateRol = async (req, res) => {
  try {
    const { id } = req.params;
    const { rol } = req.body;

    const usuarioActualizado = await Usuario.findByIdAndUpdate(
      id,
      { rol },
      { new: true }
    );

    if (!usuarioActualizado) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(usuarioActualizado);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar el rol" });
  }
};

// Eliminar un usuario (solo para administradores)
const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    await Usuario.findByIdAndDelete(id);
    res.json({ mensaje: "Usuario eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar el usuario" });
  }
};

// verificarCorreo
const verificarCorreo = async (req, res) => {
  const { email } = req.body;

  try {
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(404).json({ error: "Correo no encontrado" });
    }
    res.status(200).json({ mensaje: "Correo verificado" });
  } catch (error) {
    res.status(500).json({ error: "Error al verificar el correo" });
  }
};

const preguntas = {
  "personaje-favorito": "¿Cuál es tu personaje favorito?",
  "pelicula-favorita": "¿Cuál es tu película favorita?",
  "mejor-amigo": "¿Quién es tu mejor amigo?",
  "nombre-mascota": "¿Cuál es el nombre de tu mascota?",
  "deporte-favorito": "¿Cuál es tu deporte favorito?",
};

// obtenerPregunta
const obtenerPregunta = async (req, res) => {
  const { email } = req.body;

  try {
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(404).json({ error: "Correo no encontrado" });
    }

    const preguntaCompleta = preguntas[usuario.preguntaSecreta];
    if (!preguntaCompleta) {
      return res.status(400).json({ error: "Pregunta secreta no válida" });
    }

    res.status(200).json({ preguntaSecreta: preguntaCompleta });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener la pregunta secreta" });
  }
};

// verificarRespuesta
const verificarRespuesta = async (req, res) => {
  const { email, respuesta } = req.body;

  try {
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(404).json({ error: "Correo no encontrado" });
    }
    if (usuario.respuestaSecreta !== respuesta) {
      return res.status(400).json({ error: "Respuesta incorrecta" });
    }
    res.status(200).json({ mensaje: "Respuesta correcta" });
  } catch (error) {
    res.status(500).json({ error: "Error al verificar la respuesta" });
  }
};

// cambiarContrasena
const cambiarContrasena = async (req, res) => {
  const { email, nuevaPassword } = req.body;

  try {
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(440).json({ error: "Correo no encontrado" });
    }
    const hashedPassword = await bcrypt.hash(nuevaPassword, 10);
    usuario.password = hashedPassword;
    await usuario.save();
    res.status(200).json({ mensaje: "Contraseña cambiada con éxito" });
  } catch (error) {
    res.status(500).json({ error: "Error al cambiar la contraseña" });
  }
};

// getMiPerfil
const getMiPerfil = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user.id).select(
      "-password -respuestaSecreta"
    );

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json(usuario);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor al obtener perfil" });
  }
};

// updateMiPerfil
const updateMiPerfil = async (req, res) => {
  try {
    const { nombre, ap, am, username, email, telefono } = req.body;
    const userId = req.user.id;

    if (username) {
      const existingUsername = await Usuario.findOne({
        username,
        _id: { $ne: userId },
      });
      if (existingUsername) {
        return res
          .status(400)
          .json({ error: "Ese nombre de usuario ya está en uso" });
      }
    }
    if (email) {
      const existingEmail = await Usuario.findOne({
        email,
        _id: { $ne: userId },
      });
      if (existingEmail) {
        return res.status(400).json({ error: "Ese email ya está en uso" });
      }
    }

    const camposAActualizar = {
      nombre,
      ap,
      am,
      username,
      email,
      telefono,
    };

    const usuarioActualizado = await Usuario.findByIdAndUpdate(
      userId,
      { $set: camposAActualizar },
      { new: true, runValidators: true, context: "query" }
    ).select("-password");

    if (!usuarioActualizado) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(usuarioActualizado);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Error en el servidor al actualizar perfil" });
  }
};

// --- 2. AÑADIR ESTA NUEVA FUNCIÓN AL FINAL ---
const googleLogin = async (req, res) => {
  const { idToken } = req.body; // Recibimos el token de Google desde el frontend

  try {
    // 1. Verificar el token de Google
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience:
        "610797077240-hd26f06tg0k68v7hhtuoi5fdl76a50rf.apps.googleusercontent.com",
    });
    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(400).json({ error: "Token de Google inválido" });
    }

    const { email, name } = payload;

    // 2. Buscar si el usuario ya existe en nuestra DB
    let usuario = await Usuario.findOne({ email: email });

    if (!usuario) {
      // 3. Si NO existe (Registro): Creamos un nuevo usuario
      // Creamos un usuario "incompleto" solo con los datos de Google
      usuario = new Usuario({
        nombre: name,
        email: email,
        // El resto de campos (ap, am, username, telefono, etc.) quedan como null
        // ya que no son 'required'
      });
      await usuario.save();
    }

    // 4. Si SÍ existe (Login): Generamos nuestro propio JWT
    const token = jwt.sign({ id: usuario._id, rol: usuario.rol }, "secreto", {
      expiresIn: "1h",
    });

    // 5. Devolvemos NUESTRO token (no el de Google)
    res.json({ token, rol: usuario.rol, nombre: usuario.nombre });
  } catch (error) {
    console.error("Error en googleLogin:", error.mensaje);
    res
      .status(401)
      .json({
        error: "token de google invalido o expirado",
      });
  }
};

// Exportar todas las funciones
module.exports = {
  registerUser,
  loginUser,
  googleLogin,
  verifyLoginCode, // La nueva función de 2FA
  getUsuarios,
  updateRol,
  deleteUsuario,
  verificarCorreo,
  obtenerPregunta,
  verificarRespuesta,
  cambiarContrasena,
  getMiPerfil,
  updateMiPerfil,
};
