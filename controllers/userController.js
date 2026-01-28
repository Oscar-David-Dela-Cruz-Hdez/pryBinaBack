/* hacer lo de xss o xxs, como se llame
*/
const filterXSS = require('xss');

const Usuario = require("../models/Usuario");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SibApiV3Sdk = require("sib-api-v3-sdk");

const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client();
let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

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

    // Hashear la respuesta secreta
    const hashedRespuestaSecreta = await bcrypt.hash(respuestaSecreta, 10);
    usuario.preguntaSecreta = preguntaSecreta;
    usuario.respuestaSecreta = hashedRespuestaSecreta;
    await usuario.save();

    res
      .status(200)
      .json({ mensaje: "Pregunta y respuesta secreta actualizadas con éxito" });
  } catch (error) {
    console.error("Error al actualizar pregunta/respuesta secreta:", error);
    res
      .status(500)
      .json({ error: "Error al actualizar la pregunta/respuesta secreta" });
  }
};

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
      respuestaSecreta: respSecreta,
    });

    await nuevoUsuario.save();
    res
      .status(201)
      .json({ mensaje: "Usuario registrado con éxito", usuario: nuevoUsuario });
  } catch (error) {
    res.status(500).json({ error: "Error al registrar usuario" });
  }
};

//codigo 3, final, temporal
const loginUser = async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip;
  const key = `${email}:${ip}`;

  if (!req.loginAttempts[key]) {
    req.loginAttempts[key] = {
      attempts: 0,
      lastAttempt: Date.now(),
      blockedUntil: 0,
    };
  }

  if (req.loginAttempts[key].blockedUntil > Date.now()) {
    const remainingTime = Math.ceil(
      (req.loginAttempts[key].blockedUntil - Date.now()) / 60000
    );
    return res
      .status(429)
      .json({
        error: `Demasiados intentos fallidos. Por favor, intenta de nuevo en ${remainingTime} minutos.`,
      });
  }

  try {
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      req.loginAttempts[key].attempts += 1;
      if (req.loginAttempts[key].attempts >= 3) {
        req.loginAttempts[key].blockedUntil = Date.now() + 30 * 60 * 1000;
      }
      req.loginAttempts[key].lastAttempt = Date.now();
      return res.status(400).json({ error: "Usuario no encontrado" });
    }

    const esValida = await bcrypt.compare(password, usuario.password);
    if (!esValida) {
      req.loginAttempts[key].attempts += 1;
      if (req.loginAttempts[key].attempts >= 3) {
        req.loginAttempts[key].blockedUntil = Date.now() + 30 * 60 * 1000;
      }
      req.loginAttempts[key].lastAttempt = Date.now();
      return res.status(400).json({ error: "Contraseña incorrecta" });
    }

    // Si las credenciales son correctas, reiniciar los intentos fallidos
    req.loginAttempts[key].attempts = 0;
    req.loginAttempts[key].blockedUntil = 0;

    // Invalidar tokens activos anteriores
    usuario.activeTokens = [];

    const codigo2FA = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = Date.now() + 10 * 60 * 1000;
    usuario.loginCode = codigo2FA;
    usuario.loginCodeExpires = expiracion;
    await usuario.save();

    let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.to = [{ email: usuario.email, name: usuario.nombre }];
    sendSmtpEmail.sender = {
      name: "Distribuidora Panamericana",
      email: "delacruzhernandezoscardavid@gmail.com",
    };
    sendSmtpEmail.subject = "Tu Código de Inicio de Sesión";
    sendSmtpEmail.htmlContent = `<strong>Hola ${usuario.nombre},<br>Tu código de seguridad es: ${codigo2FA}</strong><br>Expira en 10 minutos.`;
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    res
      .status(200)
      .json({ mensaje: "Código de seguridad enviado a tu correo" });
  } catch (error) {
    console.error("Error en loginUser:", error);
    res.status(500).json({ error: "Error en el servidor al enviar el código" });
  }
};

//codigo 3, final, temporal
const verifyLoginCode = async (req, res) => {
  const { email, code } = req.body;
  try {
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(400).json({ error: "Usuario no encontrado" });
    }
    if (usuario.loginCode !== code) {
      return res.status(400).json({ error: "Código incorrecto" });
    }
    if (Date.now() > usuario.loginCodeExpires) {
      return res.status(400).json({ error: "El código ha expirado" });
    }

    // Generar un nuevo token usando RS256
    const token = jwt.sign(
      { id: usuario._id, rol: usuario.rol },
      req.privateKey,
      {
        expiresIn: "1h",
        algorithm: "RS256",
      }
    );

    if (!usuario.activeTokens) {
      usuario.activeTokens = [];
    }

    usuario.activeTokens.push(token);
    await usuario.save();

    usuario.loginCode = undefined;
    usuario.loginCodeExpires = undefined;
    await usuario.save();

    res.json({ token, rol: usuario.rol, nombre: usuario.nombre });
  } catch (error) {
    console.error(error.message);
    res
      .status(500)
      .json({ error: "Error en el servidor al verificar el código" });
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

const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    await Usuario.findByIdAndDelete(id);
    res.json({ mensaje: "Usuario eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar el usuario" });
  }
};

//final, temporal
const verificarCorreo = async (req, res) => {
  const { email } = req.body;
  const ip = req.ip;
  const key = `${email}:${ip}`;

  if (!req.recoveryAttempts[key]) {
    req.recoveryAttempts[key] = { attempts: 0, lastAttempt: Date.now() };
  }

  req.recoveryAttempts[key].attempts += 1;

  if (
    req.recoveryAttempts[key].attempts > 3 &&
    Date.now() - req.recoveryAttempts[key].lastAttempt < 3600000
  ) {
    return res
      .status(429)
      .json({
        error:
          "Demasiados intentos de recuperación. Por favor, intenta de nuevo más tarde.",
      });
  }

  if (Date.now() - req.recoveryAttempts[key].lastAttempt > 3600000) {
    req.recoveryAttempts[key].attempts = 1;
  }

  req.recoveryAttempts[key].lastAttempt = Date.now();

  res
    .status(200)
    .json({
      mensaje:
        "Si el correo está registrado, se ha enviado un mensaje de recuperación.",
    });
};

const preguntas = {
  "personaje-favorito": "¿Cuál es tu personaje favorito?",
  "pelicula-favorita": "¿Cuál es tu película favorita?",
  "mejor-amigo": "¿Quién es tu mejor amigo?",
  "nombre-mascota": "¿Cuál es el nombre de tu mascota?",
  "deporte-favorito": "¿Cuál es tu deporte favorito?",
};

//final, temporal
const obtenerPregunta = async (req, res) => {
  try {
    const { email } = req.body;
    const ip = req.ip;
    const key = `${email}:${ip}`;

    if (!req.recoveryAttempts[key]) {
      req.recoveryAttempts[key] = { attempts: 0, lastAttempt: Date.now() };
    }

    req.recoveryAttempts[key].attempts += 1;

    if (
      req.recoveryAttempts[key].attempts > 3 &&
      Date.now() - req.recoveryAttempts[key].lastAttempt < 3600000
    ) {
      return res
        .status(429)
        .json({
          error:
            "Demasiados intentos de recuperación. Por favor, intenta de nuevo más tarde.",
        });
    }

    if (Date.now() - req.recoveryAttempts[key].lastAttempt > 3600000) {
      req.recoveryAttempts[key].attempts = 1;
    }

    req.recoveryAttempts[key].lastAttempt = Date.now();

    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res
        .status(404)
        .json({
          error:
            "Si el correo está registrado, se ha enviado un mensaje de recuperación.",
        });
    }

    const preguntaCompleta = preguntas[usuario.preguntaSecreta];
    if (!preguntaCompleta) {
      return res.status(400).json({ error: "Pregunta secreta no válida" });
    }

    res.status(200).json({ preguntaSecreta: preguntaCompleta });
  } catch (error) {
    console.error("Error al obtener pregunta:", error);
    res.status(500).json({ error: "No se pudo obtener la pregunta secreta." });
  }
};

const verificarRespuesta = async (req, res) => {
  const { email, respuesta } = req.body;
  try {
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(404).json({ error: "Correo no encontrado" });
    }
    // Comparar la respuesta hasheada
    const esValida = await bcrypt.compare(respuesta, usuario.respuestaSecreta);
    if (!esValida) {
      return res.status(400).json({ error: "Respuesta incorrecta" });
    }
    res.status(200).json({ mensaje: "Respuesta correcta" });
  } catch (error) {
    res.status(500).json({ error: "Error al verificar la respuesta" });
  }
};

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

// ---google
const googleLogin = async (req, res) => {
  console.log("👉 INICIO LOGIN GOOGLE");
  const { idToken } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience:
        "610797077240-hd26f06tg0k68v7hhtuoi5fdl76a50rf.apps.googleusercontent.com",
      clockTolerance: 10,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(400).json({ error: "Token de Google inválido" });
    }

    const { email, name } = payload;

    let usuario = await Usuario.findOne({ email: email });

    if (!usuario) {
      const baseName = email.split("@")[0];

      const randomNum = Math.floor(1000 + Math.random() * 9000);

      const generatedUsername = `${baseName}${randomNum}`;

      usuario = new Usuario({
        nombre: name,
        email: email,
        username: generatedUsername,
        rol: "usuario",
      });

      await usuario.save();
    }

    const token = jwt.sign({ id: usuario._id, rol: usuario.rol }, "secreto", {
      expiresIn: "1h",
    });

    res.json({ token, rol: usuario.rol, nombre: usuario.nombre });
  } catch (error) {
    console.error("Error en googleLogin:", error.message);
    res.status(401).json({
      error: "Token de Google inválido o expirado",
      detalle: error.message,
    });
  }
};

///se agrego para las verificaciones en el formulario de registro, no muevas aqui liz

const checkUsername = async (req, res) => {
  const { username } = req.body;
  try {
    const existingUsername = await Usuario.findOne({ username });
    res.status(200).json({ available: !existingUsername });
  } catch (error) {
    res.status(500).json({ error: "Error al verificar el nombre de usuario" });
  }
};

const checkEmail = async (req, res) => {
  const { email } = req.body;
  try {
    const existingEmail = await Usuario.findOne({ email });
    res.status(200).json({ available: !existingEmail });
  } catch (error) {
    res.status(500).json({ error: "Error al verificar el correo electrónico" });
  }
};

const checkPhone = async (req, res) => {
  const { telefono } = req.body;
  try {
    const existingTelefono = await Usuario.findOne({ telefono });
    res.status(200).json({ available: !existingTelefono });
  } catch (error) {
    res.status(500).json({ error: "Error al verificar el teléfono" });
  }
};

module.exports = {
  registerUser,
  loginUser,
  googleLogin,
  verifyLoginCode,
  getUsuarios,
  updateRol,
  deleteUsuario,
  verificarCorreo,
  obtenerPregunta,
  verificarRespuesta,
  cambiarContrasena,
  getMiPerfil,
  updateMiPerfil,
  updatePassword,
  updateSecret,
  checkUsername,
  checkEmail,
  checkPhone,
};