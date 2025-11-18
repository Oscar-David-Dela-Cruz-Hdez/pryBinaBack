const Usuario = require("../models/Usuario");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SibApiV3Sdk = require("sib-api-v3-sdk");

const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client();
let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

/**/
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

    res.status(200).json({ mensaje: "Pregunta y respuesta secreta actualizadas con éxito" });
  } catch (error) {
    console.error("Error al actualizar pregunta/respuesta secreta:", error);
    res.status(500).json({ error: "Error al actualizar la pregunta/respuesta secreta" });
  }
};

/**/

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
    const { nombre, ap, am, password, preguntaSecreta, respuestaSecreta } = req.body;
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

    usuario.loginCode = undefined;
    usuario.loginCodeExpires = undefined;
    await usuario.save();

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
    res.status(200).json({ preguntaSecreta: preguntaCompleta }); // Devuelve la pregunta completa
  } catch (error) {
    res.status(500).json({ error: "Error al obtener la pregunta secreta" });
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
/* const googleLogin = async (req, res) => {
  console.log("👉 INICIO LOGIN GOOGLE");
  console.log("📦 Cuerpo completo (req.body):", req.body);
  const { idToken } = req.body;
  console.log("🔑 Token extraído:", idToken);
  try {
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience:
        "610797077240-hd26f06tg0k68v7hhtuoi5fdl76a50rf.apps.googleusercontent.com",
        clockTolerance: 10
    });
    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(400).json({ error: "Token de Google inválido" });
    }

    const { email, name } = payload;

    let usuario = await Usuario.findOne({ email: email });

    if (!usuario) {

      usuario = new Usuario({
        nombre: name,
        email: email,

      });
      await usuario.save();
    }

    const token = jwt.sign({ id: usuario._id, rol: usuario.rol }, "secreto", {
      expiresIn: "1h",
    });

    res.json({ token, rol: usuario.rol, nombre: usuario.nombre });
  } catch (error) {
    console.error("Error en googleLogin:", error.message);
    res
      .status(401)
      .json({
        error: "token de google invalido o expirado",
      });
  }
}; */

// ---google
const googleLogin = async (req, res) => {
  // Logs para depurar (puedes quitarlos después si quieres)
  console.log("👉 INICIO LOGIN GOOGLE");
  const { idToken } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: "610797077240-hd26f06tg0k68v7hhtuoi5fdl76a50rf.apps.googleusercontent.com",
      clockTolerance: 10 
    });
    
    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(400).json({ error: "Token de Google inválido" });
    }

    const { email, name } = payload;

    // Buscamos si ya existe por el correo
    let usuario = await Usuario.findOne({ email: email });

    if (!usuario) {
      // --- AQUÍ ESTÁ LA MAGIA PARA ARREGLAR EL ERROR ---
      
      // 1. Tomamos la parte del correo antes del @ (ej: "juan.perez" de juan.perez@gmail.com)
      const baseName = email.split("@")[0]; 
      
      // 2. Generamos 4 números aleatorios (ej: 4821)
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      
      // 3. Creamos un usuario único (ej: "juan.perez4821")
      const generatedUsername = `${baseName}${randomNum}`;

      // 4. (Opcional) Generamos una contraseña basura para que no falle si tu modelo la requiere
      // Si tu modelo permite password null, puedes quitar esta línea.
      const dummyPassword = await bcrypt.hash(Math.random().toString(36), 10);

      usuario = new Usuario({
        nombre: name,
        email: email,
        username: generatedUsername, // ¡Ahora sí es único y Mongo no se quejará!
        password: dummyPassword,
        // Rellenamos otros campos para evitar problemas de validación
        telefono: "", 
        rol: "usuario"
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
        detalle: error.message
    });
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
  updateSecret
};
