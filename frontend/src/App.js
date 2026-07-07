import { useState, useEffect, useRef } from "react";
import "./App.css";

// Components
import ChatSidebar from "./components/ChatSidebar";
import MessageList from "./components/MessageList";
import ChatInput from "./components/ChatInput";
import AuthScreen from "./components/AuthScreen";
import TopBar from "./components/TopBar";

// Hooks
import { useTheme } from "./hooks/useTheme";
import { useChatLogic } from "./hooks/useChatLogic";

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("chatbot_token") || null);
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("chatbot_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const { temaOscuro, setTemaOscuro } = useTheme();

  const {
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
  } = useChatLogic(token);

  const inputFileRef = useRef(null);
  const chatRef = useRef(null);

  useEffect(() => {
    chatRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [mensajes]);

  const preguntasRapidas = [
    "¿Qué puedes hacer?",
    "Ayúdame con React",
    "Resume el archivo",
  ];

  if (!token) {
    return <AuthScreen setToken={setToken} setUser={setUser} />;
  }

  return (
    <div className="app-container">
      <ChatSidebar
        mostrarChats={mostrarChats}
        chats={chats}
        chatActivo={chatActivo}
        setChatActivo={(id) => {
          setChatActivo(id);
          if (window.innerWidth <= 768) setMostrarChats(false);
        }}
        nuevoChat={nuevoChat}
        limpiarChat={limpiarChat}
        eliminarChat={eliminarChat}
        renombrarChat={renombrarChat}
        archivoDelChat={archivoDelChat}
        eliminarArchivoDelChat={eliminarArchivoDelChat}
        temaOscuro={temaOscuro}
        setTemaOscuro={setTemaOscuro}
        onLogout={() => {
          localStorage.removeItem("chatbot_token");
          localStorage.removeItem("chatbot_user");
          setToken(null);
          setUser(null);
        }}
        user={user}
      />
      <div className="chat-area">
        <TopBar 
          mostrarChats={mostrarChats}
          setMostrarChats={setMostrarChats}
          chatTitulo={chats.find(c => c.id === chatActivo)?.titulo}
          numMensajes={mensajes.length}
        />
        <MessageList
          mensajes={mensajes}
          respondiendo={respondiendo}
          preguntasRapidas={preguntasRapidas}
          setMensaje={setMensaje}
          archivoDelChat={archivoDelChat}
          regenerarUltimaRespuesta={regenerarUltimaRespuesta}
          editarMensaje={editarMensaje}
          chatRef={chatRef}
        />

        <ChatInput
          inputFileRef={inputFileRef}
          archivo={archivo}
          setArchivo={setArchivo}
          cargandoArchivo={cargandoArchivo}
          respondiendo={respondiendo}
          archivoDelChat={archivoDelChat}
          mensaje={mensaje}
          setMensaje={setMensaje}
          manejarEnter={manejarEnter}
          subirArchivo={() => subirArchivo(inputFileRef)}
          enviarMensaje={enviarMensaje}
          detenerGeneracion={detenerGeneracion}
          imagenAdjunta={imagenAdjunta}
          setImagenAdjunta={setImagenAdjunta}
        />
      </div>
    </div>
  );
}

export default App;