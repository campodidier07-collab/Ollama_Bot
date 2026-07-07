import { useState, useEffect, useRef } from "react";

export const useChatLogic = (token) => {
  const [mensaje, setMensaje] = useState("");
  const [imagenAdjunta, setImagenAdjunta] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [cargandoArchivo, setCargandoArchivo] = useState(false);
  const [respondiendo, setRespondiendo] = useState(false);
  const [mostrarChats, setMostrarChats] = useState(window.innerWidth > 768);

  const [chats, setChats] = useState([]);
  const [chatActivo, setChatActivo] = useState(null);
  const cargadoInicial = useRef(false);
  const abortControllerRef = useRef(null);

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  // 1. Cargar chats del servidor
  useEffect(() => {
    if (!token) return;

    fetch(`${API_URL}/api/chats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.length > 0) {
          setChats(data);
          setChatActivo(data[0].id);
        } else {
          const nuevo = { id: Date.now().toString(), titulo: "Nuevo chat", mensajes: [], archivo: null };
          setChats([nuevo]);
          setChatActivo(nuevo.id);
        }
        cargadoInicial.current = true;
      })
      .catch((err) => console.error("Error cargando chats", err));
  }, [token, API_URL]);

  // 2. Guardado automático (Debounce)
  useEffect(() => {
    if (!cargadoInicial.current || !token || chats.length === 0 || !chatActivo) return;

    const timeout = setTimeout(() => {
      const chatParaGuardar = chats.find((c) => c.id === chatActivo);
      if (chatParaGuardar) {
        fetch(`${API_URL}/api/chats`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(chatParaGuardar),
        })
          .then((res) => {
            if (!res.ok) throw new Error("Error del servidor al guardar en BD");
          })
          .catch((err) => console.error("Error guardando chat (¿Está encendido MySQL?):", err));
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [chats, chatActivo, token, API_URL]);

  const chatActual = chats.find((chat) => chat.id === chatActivo) || {};
  const mensajes = chatActual.mensajes || [];
  const archivoDelChat = chatActual.archivo || null;

  const nuevoChat = () => {
    if (respondiendo) return;
    const nuevo = {
      id: Date.now().toString(),
      titulo: "Nuevo chat",
      mensajes: [],
      archivo: null,
    };
    setChats((prev) => [nuevo, ...prev]);
    setChatActivo(nuevo.id);
    if (window.innerWidth <= 768) {
      setMostrarChats(false);
    }
  };

  const actualizarTituloChat = (texto) => {
    setChats((prevChats) =>
      prevChats.map((chat) => {
        if (chat.id !== chatActivo) return chat;
        if (chat.titulo !== "Nuevo chat") return chat;
        return {
          ...chat,
          titulo: texto.length > 25 ? texto.slice(0, 25) + "..." : texto,
        };
      })
    );
  };

  const actualizarRespuestaBot = (chatId, botIndex, texto) => {
    setChats((prevChats) =>
      prevChats.map((chat) => {
        if (chat.id !== chatId) return chat;
        const nuevosMensajes = [...chat.mensajes];
        nuevosMensajes[botIndex] = { texto, tipo: "bot" };
        return { ...chat, mensajes: nuevosMensajes };
      })
    );
  };

  const enviarMensaje = async (textoAlternativo = null) => {
    const textoMensaje = typeof textoAlternativo === 'string' ? textoAlternativo : mensaje;
    if (textoMensaje.trim() === "" || respondiendo) return;

    if (textoMensaje.trim().toLowerCase() === "/clear") {
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === chatActivo ? { ...chat, mensajes: [] } : chat
        )
      );
      setMensaje("");
      return;
    }

    const currentChatId = chatActivo;
    if (typeof textoAlternativo !== 'string') {
      setMensaje("");
    }
    
    const base64Img = imagenAdjunta; // Guardamos copia local por si cambia
    if (typeof textoAlternativo !== 'string') {
      setImagenAdjunta(null); // Limpiamos después de guardar
    }

    setRespondiendo(true);
    actualizarTituloChat(textoMensaje);

    const mensajeUsuario = { 
      texto: textoMensaje, 
      tipo: "usuario",
      imagenBase64: base64Img 
    };
    const historialActual = chats.find((chat) => chat.id === currentChatId)?.mensajes || [];
    const botIndex = historialActual.length + 1;

    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === currentChatId
          ? {
              ...chat,
              mensajes: [...chat.mensajes, mensajeUsuario, { texto: "...", tipo: "bot" }],
            }
          : chat
      )
    );

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          mensaje: textoMensaje,
          historial: historialActual.slice(-6),
          chatId: currentChatId,
          imagenBase64: base64Img
        }),
      });

      if (!response.ok) throw new Error("Error en el servidor");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let respuestaCompleta = "";
      let ultimaActualizacion = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        respuestaCompleta += chunk;
        const ahora = Date.now();
        if (ahora - ultimaActualizacion > 50) {
          actualizarRespuestaBot(currentChatId, botIndex, respuestaCompleta || "...");
          ultimaActualizacion = ahora;
        }
      }
      actualizarRespuestaBot(currentChatId, botIndex, respuestaCompleta || "No recibí respuesta.");
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log("Generación detenida por el usuario");
        // No sobreescribir el texto si el usuario lo detuvo manualmente, 
        // simplemente dejamos lo que ya se generó.
      } else {
        console.log(error);
        actualizarRespuestaBot(currentChatId, botIndex, `❌ Error conectando con el servidor.`);
      }
    } finally {
      setRespondiendo(false);
    }
  };

  const detenerGeneracion = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setRespondiendo(false);
    }
  };

  const regenerarUltimaRespuesta = () => {
    if (respondiendo) return;
    const currentChatId = chatActivo;
    const historialActual = chats.find((chat) => chat.id === currentChatId)?.mensajes || [];
    
    let ultimoUsuarioIndex = -1;
    for (let i = historialActual.length - 1; i >= 0; i--) {
      if (historialActual[i].tipo === "usuario") {
        ultimoUsuarioIndex = i;
        break;
      }
    }

    if (ultimoUsuarioIndex === -1) return;

    const textoUltimoMensaje = historialActual[ultimoUsuarioIndex].texto;
    const nuevoHistorial = historialActual.slice(0, ultimoUsuarioIndex);

    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === currentChatId
          ? { ...chat, mensajes: nuevoHistorial }
          : chat
      )
    );

    // Le damos un respiro a React para que actualice el estado y luego enviamos
    setTimeout(() => {
      enviarMensaje(textoUltimoMensaje);
    }, 100);
  };

  const editarMensaje = (indexUsuario, nuevoTexto) => {
    if (respondiendo) return;
    const currentChatId = chatActivo;
    const historialActual = chats.find((chat) => chat.id === currentChatId)?.mensajes || [];
    
    // Validar que el índice es de un mensaje de usuario
    if (historialActual[indexUsuario]?.tipo !== "usuario") return;

    // Cortar el historial hasta justo ANTES del mensaje a editar
    const nuevoHistorial = historialActual.slice(0, indexUsuario);

    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === currentChatId
          ? { ...chat, mensajes: nuevoHistorial }
          : chat
      )
    );

    setTimeout(() => {
      enviarMensaje(nuevoTexto);
    }, 100);
  };

  const subirArchivo = async (inputFileRef) => {
    if (!archivo || cargandoArchivo || respondiendo) return;
    setCargandoArchivo(true);
    const currentChatId = chatActivo;
    const formData = new FormData();
    formData.append("archivo", archivo);
    formData.append("chatId", currentChatId);

    try {
      const esPDF = archivo.type === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf");
      const url = esPDF ? `${API_URL}/upload-pdf` : `${API_URL}/upload`;
      const response = await fetch(url, { method: "POST", body: formData });
      if (!response.ok) throw new Error("Error subiendo archivo");

      const data = await response.json();
      const nombreArchivo = data.archivo || archivo.name;
      const mensajeArchivo = {
        texto: `📄 **Archivo analizado:** ${nombreArchivo}\n\n${data.respuesta}`,
        tipo: "bot",
      };

      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === currentChatId
            ? {
                ...chat,
                archivo: { nombre: nombreArchivo, tipo: esPDF ? "pdf" : "txt" },
                mensajes: [...chat.mensajes, mensajeArchivo],
              }
            : chat
        )
      );
      setArchivo(null);
      if (inputFileRef?.current) inputFileRef.current.value = "";
    } catch (error) {
      console.log(error);
    } finally {
      setCargandoArchivo(false);
    }
  };

  const eliminarArchivoDelChat = async () => {
    if (respondiendo || cargandoArchivo) return;
    try {
      await fetch(`${API_URL}/archivo/${chatActivo}`, { method: "DELETE" });
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === chatActivo ? { ...chat, archivo: null } : chat
        )
      );
    } catch (error) {
      console.log(error);
    }
  };

  const limpiarChat = () => {
    if (respondiendo) return;
    setChats((prevChats) =>
      prevChats.map((chat) => (chat.id === chatActivo ? { ...chat, mensajes: [] } : chat))
    );
  };

  const eliminarChat = async (chatIdAEliminar) => {
    if (respondiendo) return;
    
    // Eliminar en el servidor
    try {
      await fetch(`${API_URL}/api/chats/${chatIdAEliminar}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error("Error eliminando chat del servidor");
    }

    if (chats.length <= 1) {
      const nuevo = { id: Date.now().toString(), titulo: "Nuevo chat", mensajes: [], archivo: null };
      setChats([nuevo]);
      setChatActivo(nuevo.id);
      return;
    }

    const nuevosChats = chats.filter((chat) => chat.id !== chatIdAEliminar);
    setChats(nuevosChats);
    if (chatActivo === chatIdAEliminar) {
      setChatActivo(nuevosChats[0].id);
    }
  };

  const renombrarChat = (chatId, nuevoTitulo) => {
    if (!nuevoTitulo.trim()) return;
    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === chatId ? { ...chat, titulo: nuevoTitulo.trim() } : chat
      )
    );
  };

  const manejarEnter = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  };

  return {
    chats,
    chatActivo,
    setChatActivo,
    mensajes,
    archivoDelChat,
    mensaje,
    setMensaje,
    archivo,
    setArchivo,
    cargandoArchivo,
    respondiendo,
    mostrarChats,
    setMostrarChats,
    nuevoChat,
    eliminarChat,
    renombrarChat,
    limpiarChat,
    eliminarArchivoDelChat,
    subirArchivo,
    enviarMensaje,
    manejarEnter,
    detenerGeneracion,
    regenerarUltimaRespuesta,
    editarMensaje,
    imagenAdjunta,
    setImagenAdjunta,
  };
};
