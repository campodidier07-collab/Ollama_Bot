require("dotenv").config();
const pdfParse = require("pdf-parse");
const multer = require("multer");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const google = require("googlethis");
const { exec } = require("child_process");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy_key");

const app = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));

// Inicializar DB
const pool = require('./db');

// Rutas de MySQL
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chats');

app.use('/api', authRoutes);
app.use('/api/chats', chatRoutes);

/*
  Ahora usamos Gemini API para poder desplegar a la nube gratis!
*/
const PORT = process.env.PORT || 5000;

// Crear carpeta uploads si no existe
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname)
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB
  },
});

// Obtener ID del chat
function obtenerChatId(req) {
  return req.body.chatId || "chat_default";
}

// Limitar texto largo
function limitarTexto(texto, limite = 6000) {
  if (!texto) return "";
  return texto.length > limite ? texto.slice(0, limite) : texto;
}

// Detectar si el usuario pregunta por el archivo
function preguntaSobreArchivo(mensaje) {
  const texto = mensaje.toLowerCase();

  return (
    texto.includes("pdf") ||
    texto.includes("archivo") ||
    texto.includes("documento") ||
    texto.includes("texto") ||
    texto.includes("resumen") ||
    texto.includes("analiza") ||
    texto.includes("eso") ||
    texto.includes("este")
  );
}

// ===============================
// FUNCIONES RAG (Inteligencia Vectorial)
// ===============================
function splitTextIntoChunks(text, chunkSize = 1000) {
  const words = text.split(/\s+/);
  const chunks = [];
  let currentChunk = [];

  for (const word of words) {
    currentChunk.push(word);
    if (currentChunk.join(" ").length >= chunkSize) {
      chunks.push(currentChunk.join(" "));
      currentChunk = [];
    }
  }
  if (currentChunk.length > 0) chunks.push(currentChunk.join(" "));
  return chunks;
}

async function getEmbedding(texto) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-2"});
    const result = await model.embedContent(texto);
    return result.embedding.values;
  } catch (error) {
    console.error("Error obteniendo embedding con Gemini:", error);
    return null;
  }
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ===============================
// CHAT NORMAL
// ===============================
app.post("/chat", async (req, res) => {
  const mensaje = req.body.mensaje || "";
  const historial = req.body.historial || [];
  const chatId = req.body.chatId || "chat_default";
  const imagenBase64 = req.body.imagenBase64;

  let archivoDelChat = null;
  try {
    const [rows] = await pool.query('SELECT archivo FROM chats WHERE id = ?', [chatId]);
    if (rows.length > 0 && rows[0].archivo) {
      archivoDelChat = rows[0].archivo;
    }
  } catch (dbErr) {
    console.error("Error obteniendo archivo de BD:", dbErr);
  }

  try {
    if (!mensaje.trim()) {
      return res.status(400).json({
        error: "Mensaje vacío",
      });
    }

    // Detección de Búsqueda Web
    const lowerMsg = mensaje.toLowerCase();
    let esComandoWeb = lowerMsg.startsWith("/web");
    let esComandoPdf = lowerMsg.startsWith("/pdf");
    
    // Limpiamos los comandos del mensaje final
    let mensajeProcesado = mensaje;
    if (esComandoWeb) mensajeProcesado = mensaje.replace(/^\/web/i, "").trim();
    if (esComandoPdf) mensajeProcesado = mensaje.replace(/^\/pdf/i, "").trim();

    // INTERCEPCIÓN DE DIBUJO (Pollinations.ai)
    const quiereImagen = lowerMsg.includes("dibuja") || 
                         lowerMsg.includes("pinta") || 
                         lowerMsg.includes("genera una imagen") || 
                         lowerMsg.includes("crea una imagen");

    if (quiereImagen) {
      console.log("Intercepción: Generando imagen con Pollinations...");
      const promptLimpio = mensajeProcesado.replace(/dibuja|pinta|genera una imagen|crea una imagen/gi, "").trim();
      const encodedPrompt = encodeURIComponent(promptLimpio || "something amazing");
      const urlImagen = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=800&nologo=true`;
      
      const respuestaArte = `¡Aquí tienes tu obra de arte! 🎨\n\n![${promptLimpio}](${urlImagen})\n\n*(Generado por IA)*`;
      
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      
      // Simulamos el stream para mantener compatibilidad
      res.write(respuestaArte);
      res.end();
      return;
    }

    const necesitaInternet = esComandoWeb || 
                             lowerMsg.includes("busca") || 
                             lowerMsg.includes("internet") || 
                             lowerMsg.includes("noticia") || 
                             lowerMsg.includes("hoy") || 
                             lowerMsg.includes("precio");
                             
    let resultadosWeb = "";
    let urlsFuentes = [];
    if (necesitaInternet) {
      console.log("Realizando búsqueda web para:", mensajeProcesado);
      try {
        const options = {
          page: 0, 
          safe: false, // Safe Search
          parse_ads: false, // If set to true sponsored results will be parsed
          additional_params: {
            hl: 'es' 
          }
        };
        const response = await google.search(mensajeProcesado, options);
        if (response.results && response.results.length > 0) {
          const topResults = response.results.slice(0, 3).map(r => `Título: ${r.title}\nDescripción: ${r.description}\n`);
          urlsFuentes = response.results.slice(0, 3).map((r, i) => `[Fuente ${i + 1}](${r.url})`);
          resultadosWeb = `\nRESULTADOS DE BÚSQUEDA WEB RECIENTES:\n${topResults.join("\n")}`;
          console.log("Búsqueda completada exitosamente.");
        }
      } catch (err) {
        console.error("Error en búsqueda web:", err);
      }
    }

    // Solo últimos mensajes para responder más rápido
    const historialLimitado = historial.slice(-6);

    const contexto = historialLimitado
      .map((msg) => {
        return `${msg.tipo === "usuario" ? "Usuario" : "Bot"}: ${msg.texto}`;
      })
      .join("\n");

    const debeUsarArchivo = archivoDelChat && (esComandoPdf || preguntaSobreArchivo(mensajeProcesado));

    let contenidoArchivoLimitado = "";
    if (debeUsarArchivo) {
      if (archivoDelChat.chunks && archivoDelChat.chunks.length > 0) {
        // BÚSQUEDA VECTORIAL RAG
        console.log("Calculando embedding de la pregunta...");
        const questionEmbedding = await getEmbedding(mensaje);
        
        if (questionEmbedding) {
          console.log("Buscando fragmentos relevantes...");
          const scoredChunks = archivoDelChat.chunks.map(chunk => ({
            text: chunk.text,
            score: cosineSimilarity(questionEmbedding, chunk.embedding)
          }));
          
          scoredChunks.sort((a, b) => b.score - a.score);
          const topChunks = scoredChunks.slice(0, 3).map(c => c.text);
          contenidoArchivoLimitado = topChunks.join("\n\n...\n\n");
          console.log("Fragmentos encontrados. Enviando a Ollama.");
        } else {
          contenidoArchivoLimitado = limitarTexto(archivoDelChat.contenido, 6000);
        }
      } else {
        contenidoArchivoLimitado = limitarTexto(archivoDelChat.contenido, 6000);
      }
    }

    const promptCompleto = `
Eres una Inteligencia Artificial ultra-avanzada, versátil y "camaleónica".
Tu deber es analizar la intención del usuario y asumir automáticamente la personalidad adecuada para responder de la mejor forma posible:
- Si el usuario te habla de código, asume el rol de un "Programador Senior" (respuestas cortas, con markdown).
- Si te pide traducir, actúa como un "Traductor Experto" (directo y nativo).
- Si te pide redactar correos o artículos, actúa como un "Escritor Creativo".
- Si te hace preguntas legales, actúa como un "Asesor Legal".
- Si hace una pregunta general, actúa como un Asistente servicial.

NO digas "asumiré el rol de...", simplemente métete en el personaje y responde.
Responde siempre en español.

${
  debeUsarArchivo
    ? `Archivo cargado en este chat:
Nombre del archivo: ${archivoDelChat.nombre}
Tipo: ${archivoDelChat.tipo}

Contenido relevante del archivo:
${contenidoArchivoLimitado}`
    : "No uses archivo a menos que el usuario pregunte directamente por él."
}

${resultadosWeb ? `Instrucción Especial: El usuario te ha pedido información de actualidad. Usa estrictamente los siguientes resultados de búsqueda web para basar tu respuesta. No inventes datos que no estén aquí.\n${resultadosWeb}\n` : ""}

Conversación reciente:
${contexto}

Usuario: ${mensajeProcesado}

Instrucciones adicionales:
- Responde principalmente en español.
- Si el usuario pregunta por el PDF, documento o archivo, usa el contenido cargado estrictamente.
- Si no pregunta por archivo, responde normalmente sin usarlo.

Asistente:
`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    let parts = [{ text: promptCompleto }];
    
    if (imagenBase64) {
      parts.push({
        inlineData: {
          data: imagenBase64,
          mimeType: "image/jpeg"
        }
      });
      console.log("Imagen detectada. Usando Gemini 2.5 Flash Vision.");
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (urlsFuentes.length > 0) {
      const fuentesMarkdown = `**Fuentes consultadas:** ${urlsFuentes.join(" | ")}\n\n`;
      res.write(fuentesMarkdown);
    }

    const resultStream = await model.generateContentStream({
      contents: [{ role: 'user', parts: parts }]
    });

    for await (const chunk of resultStream.stream) {
      const chunkText = chunk.text();
      res.write(chunkText);
    }

    res.end();
  } catch (error) {
    console.log("Error en /chat:", error);

    res.status(500).json({
      error: "Error con Gemini API",
      detalle: error.message,
    });
  }
});

// ===============================
// SUBIR TXT
// ===============================
app.post("/upload", upload.single("archivo"), async (req, res) => {
  try {
    const chatId = obtenerChatId(req);

    console.log("TXT recibido:", req.file?.originalname);
    console.log("Chat ID:", chatId);

    if (!req.file) {
      return res.status(400).json({
        error: "No se recibió ningún archivo TXT",
      });
    }

    const contenido = fs.readFileSync(req.file.path, "utf-8");
    
    // Eliminar archivo temporal después de leerlo
    fs.unlinkSync(req.file.path);

    if (!contenido || contenido.trim() === "") {
      return res.status(400).json({
        error: "El archivo TXT está vacío",
      });
    }

    // PROCESAMIENTO RAG (Fragmentación y Vectorización)
    console.log("Iniciando procesamiento RAG (Vectorización)...");
    const textChunks = splitTextIntoChunks(contenido, 1000);
    const chunksToEmbed = textChunks.slice(0, 20); 
    const chunksConVectores = [];

    for (let i = 0; i < chunksToEmbed.length; i++) {
      console.log(`Generando vector ${i+1}/${chunksToEmbed.length}...`);
      const embedding = await getEmbedding(chunksToEmbed[i]);
      if (embedding) {
        chunksConVectores.push({ text: chunksToEmbed[i], embedding });
      }
    }
    console.log("Vectorización completada.");

    const nuevoArchivo = {
      nombre: req.file.originalname,
      tipo: "txt",
      contenido,
      chunks: chunksConVectores
    };

    // Guardar en MySQL
    await pool.query('UPDATE chats SET archivo = ? WHERE id = ?', [JSON.stringify(nuevoArchivo), chatId]);

    const contenidoLimitado = limitarTexto(contenido, 7000);

    const prompt = `
Analiza el siguiente archivo TXT:

${contenidoLimitado}

Haz un resumen claro, breve y profesional en español.
`;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);

    res.json({
      respuesta: result.response.text(),
      archivo: req.file.originalname,
      chatId,
    });
  } catch (error) {
    console.log("Error en /upload:", error);

    // Asegurarse de eliminar el archivo si hubo error y sigue ahí
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: "Error subiendo archivo TXT",
      detalle: error.message,
    });
  }
});

// ===============================
// SUBIR PDF
// ===============================
app.post("/upload-pdf", upload.single("archivo"), async (req, res) => {
  try {
    const chatId = obtenerChatId(req);

    console.log("PDF recibido:", req.file?.originalname);
    console.log("Chat ID:", chatId);

    if (!req.file) {
      return res.status(400).json({
        error: "No se recibió ningún PDF",
      });
    }

    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    const contenido = pdfData.text;

    // Eliminar archivo temporal después de leerlo
    fs.unlinkSync(req.file.path);

    if (!contenido || contenido.trim() === "") {
      return res.status(400).json({
        error:
          "El PDF no tiene texto legible. Puede ser escaneado o estar vacío.",
      });
    }

    // PROCESAMIENTO RAG (Fragmentación y Vectorización)
    console.log("Iniciando procesamiento RAG (Vectorización)...");
    const textChunks = splitTextIntoChunks(contenido, 1000);
    // Limitamos a 20 chunks (aprox 20,000 caracteres) para no bloquear el servidor con modelos lentos. 
    // En producción se usaría un modelo como 'nomic-embed-text' que es instantáneo.
    const chunksToEmbed = textChunks.slice(0, 20); 
    const chunksConVectores = [];

    for (let i = 0; i < chunksToEmbed.length; i++) {
      console.log(`Generando vector ${i+1}/${chunksToEmbed.length}...`);
      const embedding = await getEmbedding(chunksToEmbed[i]);
      if (embedding) {
        chunksConVectores.push({ text: chunksToEmbed[i], embedding });
      }
    }
    console.log("Vectorización completada.");

    const nuevoArchivo = {
      nombre: req.file.originalname,
      tipo: "pdf",
      contenido,
      chunks: chunksConVectores
    };

    // Guardar en MySQL
    await pool.query('UPDATE chats SET archivo = ? WHERE id = ?', [JSON.stringify(nuevoArchivo), chatId]);

    const contenidoLimitado = limitarTexto(contenido, 7000);

    const prompt = `
Analiza el siguiente documento:

${contenidoLimitado}

Haz un resumen claro, breve y profesional en español.
`;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);

    res.json({
      respuesta: result.response.text(),
      archivo: req.file.originalname,
      chatId,
    });
  } catch (error) {
    console.log("Error en /upload-pdf:", error);

    // Asegurarse de eliminar el archivo si hubo error y sigue ahí
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: "Error analizando PDF",
      detalle: error.message,
    });
  }
});

// ===============================
// VER ARCHIVO DEL CHAT
// ===============================
app.get("/archivo/:chatId", async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const [rows] = await pool.query('SELECT archivo FROM chats WHERE id = ?', [chatId]);
    const archivo = rows.length > 0 ? rows[0].archivo : null;

    if (!archivo) {
      return res.json({
        tieneArchivo: false,
        mensaje: "Este chat no tiene archivo cargado",
      });
    }

    res.json({
      tieneArchivo: true,
      nombre: archivo.nombre,
      tipo: archivo.tipo,
    });
  } catch (err) {
    res.status(500).json({ error: "Error de servidor" });
  }
});

// ===============================
// ELIMINAR ARCHIVO DEL CHAT
// ===============================
app.delete("/archivo/:chatId", async (req, res) => {
  try {
    const chatId = req.params.chatId;
    await pool.query('UPDATE chats SET archivo = NULL WHERE id = ?', [chatId]);
    res.json({
      mensaje: "Archivo eliminado del chat",
    });
  } catch (err) {
    res.status(500).json({ error: "Error de servidor" });
  }
});

// ===============================
// EJECUCIÓN DE CÓDIGO
// ===============================
app.post("/api/execute", (req, res) => {
  const { language, code } = req.body;
  if (!language || !code) {
    return res.status(400).json({ error: "Faltan parámetros" });
  }

  const scratchDir = path.join(__dirname, "scratch");
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir);
  }

  const ext = language === "python" || language === "py" ? "py" : "js";
  const runner = language === "python" || language === "py" ? "python" : "node";
  const filename = `temp_${Date.now()}.${ext}`;
  const filepath = path.join(scratchDir, filename);

  try {
    fs.writeFileSync(filepath, code);
  } catch (err) {
    return res.status(500).json({ error: "No se pudo crear el archivo temporal" });
  }

  exec(`${runner} "${filepath}"`, { timeout: 10000 }, (error, stdout, stderr) => {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    if (error) {
      if (error.killed) {
        return res.json({ output: "Error: El código tardó demasiado en ejecutarse (Timeout 10s)." });
      }
      return res.json({ output: stderr || error.message || "Error ejecutando el código" });
    }

    res.json({ output: stdout || "El código se ejecutó sin errores, pero no imprimió nada en consola." });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Motor de IA conectado: Gemini API`);
});