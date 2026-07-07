import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Bot, User, Copy, Check, Square, Volume2, RefreshCw, Pencil, ArrowDown } from "lucide-react";

const CodeBlock = ({ match, codeString, ...props }) => {
  const [copiado, setCopiado] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-lang">{match[1]}</span>
        <button 
          className="code-copy-btn"
          onClick={handleCopy}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', background: 'transparent', border: 'none', color: '#94A3B8' }}
        >
          {copiado ? <><Check size={14} color="#4ade80" /> Copiado</> : <><Copy size={14} /> Copiar Código</>}
        </button>
      </div>
      <SyntaxHighlighter
        children={codeString}
        style={vscDarkPlus}
        language={match[1]}
        PreTag="div"
        customStyle={{ margin: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
        {...props}
      />
    </div>
  );
};

const MessageList = ({
  mensajes,
  respondiendo,
  preguntasRapidas,
  setMensaje,
  archivoDelChat,
  regenerarUltimaRespuesta,
  editarMensaje,
}) => {
  const listRef = useRef(null);
  const endRef = useRef(null);
  const isUserScrolling = useRef(false);
  const [leyendoIndex, setLeyendoIndex] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  // Estados para la edición de mensajes
  const [editIndex, setEditIndex] = useState(null);
  const [editTexto, setEditTexto] = useState("");

  const toggleLectura = (texto, index) => {
    if (!window.speechSynthesis) {
      alert("Tu navegador no soporta síntesis de voz.");
      return;
    }

    // Si ya estamos leyendo este mensaje, lo detenemos
    if (leyendoIndex === index) {
      window.speechSynthesis.cancel();
      setLeyendoIndex(null);
      return;
    }

    // Detener cualquier lectura anterior
    window.speechSynthesis.cancel();

    // Limpiar markdown del texto para que suene natural
    const textoLimpio = texto.replace(/[*_#`]/g, "");

    const utterance = new SpeechSynthesisUtterance(textoLimpio);
    utterance.lang = "es-ES";
    
    utterance.onend = () => setLeyendoIndex(null);
    utterance.onerror = () => setLeyendoIndex(null);

    window.speechSynthesis.speak(utterance);
    setLeyendoIndex(index);
  };

  const copiarAlPortapapeles = (texto) => {
    navigator.clipboard.writeText(texto);
    // Podríamos añadir un mini toast de 'Copiado', pero el sistema lo hace tan rápido que suele bastar con el click.
  };

  // Limpiar audio al desmontar
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const handleScroll = () => {
      // Si estamos a menos de 50px del fondo, asumimos que estamos en el fondo
      const isAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 50;
      isUserScrolling.current = !isAtBottom;
      setShowScrollButton(!isAtBottom);
    };

    list.addEventListener('scroll', handleScroll);
    return () => list.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isUserScrolling.current) {
      endRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [mensajes]);

  const scrollToBottom = () => {
    isUserScrolling.current = false;
    setShowScrollButton(false);
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="message-list-container" style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="message-list" ref={listRef} style={{ flex: 1, overflowY: 'auto' }}>
        {mensajes.length === 0 && !archivoDelChat && (
        <div className="welcome-screen">
          <h2>Haz la primera pregunta. El resto lo descubrimos juntos.</h2>
        </div>
      )}

      {mensajes.length === 0 && archivoDelChat && (
        <div className="welcome-screen">
          <h2>Archivo seleccionado</h2>
          <p style={{ opacity: 0.7 }}>
            Pregúntame cualquier cosa sobre {archivoDelChat.nombre}
          </p>
        </div>
      )}

      {mensajes.map((msg, index) => (
        <div key={index} className={`message-row ${msg.tipo}`}>
          <div className="message-content-wrapper">
            <div className={`avatar ${msg.tipo}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {msg.tipo === "bot" ? <Bot size={20} /> : <User size={20} />}
            </div>
            <div className="message-text markdown-body">
              {msg.tipo === "bot" ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      if (!inline && match) {
                        const codeString = String(children).replace(/\n$/, "");
                        return <CodeBlock match={match} codeString={codeString} {...props} />;
                      }
                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {msg.texto}
                </ReactMarkdown>
              ) : (
                <div className="user-message-container">
                  {msg.imagenBase64 && (
                    <img 
                      src={`data:image/jpeg;base64,${msg.imagenBase64.data || msg.imagenBase64}`} 
                      alt="User uploaded" 
                      style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '8px' }}
                    />
                  )}
                  {editIndex === index ? (
                    <div className="edit-message-box">
                      <textarea 
                        value={editTexto}
                        onChange={(e) => setEditTexto(e.target.value)}
                        rows="3"
                        autoFocus
                      />
                      <div className="edit-actions">
                        <button onClick={() => setEditIndex(null)}>Cancelar</button>
                        <button 
                          className="save-btn" 
                          onClick={() => {
                            editarMensaje(index, editTexto);
                            setEditIndex(null);
                          }}
                        >
                          Guardar y Enviar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {msg.texto}
                      <button 
                        className="edit-btn"
                        onClick={() => {
                          setEditIndex(index);
                          setEditTexto(msg.texto);
                        }}
                        title="Editar mensaje"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                      >
                        <Pencil size={14} color="var(--text-secondary)" />
                      </button>
                    </>
                  )}
                </div>
              )}

              {msg.tipo === "bot" && (
                <div className="message-actions">
                  <button
                    className={`tts-btn ${leyendoIndex === index ? 'playing' : ''}`}
                    onClick={() => toggleLectura(msg.texto, index)}
                    title={leyendoIndex === index ? "Detener lectura" : "Leer en voz alta"}
                  >
                    {leyendoIndex === index ? <Square size={16} fill="currentColor" /> : <Volume2 size={16} />}
                  </button>
                  <button 
                    className="tts-btn"
                    onClick={() => copiarAlPortapapeles(msg.texto)}
                    title="Copiar al portapapeles"
                  >
                    <Copy size={16} />
                  </button>
                  {index === mensajes.length - 1 && !respondiendo && (
                    <button 
                      className="tts-btn"
                      onClick={regenerarUltimaRespuesta}
                      title="Regenerar respuesta"
                    >
                      <RefreshCw size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      <div ref={endRef}></div>
      </div>
      
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="scroll-to-bottom-btn"
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
            border: 'none',
            borderRadius: '20px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 10
          }}
        >
          <ArrowDown size={16} /> Nuevos Mensajes
        </button>
      )}
    </div>
  );
};

export default MessageList;
