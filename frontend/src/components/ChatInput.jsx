import React, { useState, useEffect, useRef } from "react";
import { Mic, ArrowUp, Paperclip, Camera, Square, FileText, X } from "lucide-react";

const ChatInput = ({
  inputFileRef,
  archivo,
  setArchivo,
  cargandoArchivo,
  respondiendo,
  archivoDelChat,
  mensaje,
  setMensaje,
  manejarEnter,
  subirArchivo,
  enviarMensaje,
  detenerGeneracion,
  imagenAdjunta,
  setImagenAdjunta,
}) => {
  const [escuchando, setEscuchando] = useState(false);
  const recognitionRef = useRef(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'es-ES';

      recognitionRef.current.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setMensaje(transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Error de reconocimiento de voz", event.error);
        setEscuchando(false);
      };

      recognitionRef.current.onend = () => {
        setEscuchando(false);
      };
    }
  }, [setMensaje]);

  const toggleEscuchar = () => {
    if (!recognitionRef.current) {
      alert("Tu navegador no soporta reconocimiento de voz. Por favor usa Chrome o Edge.");
      return;
    }
    
    if (escuchando) {
      recognitionRef.current.stop();
      setEscuchando(false);
    } else {
      setMensaje(""); // Limpiar mensaje antes de dictar
      recognitionRef.current.start();
      setEscuchando(true);
    }
  };

  const manejarSubidaImagen = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Guardamos solo el Base64 puro sin el data:image/png;base64,
        const base64String = reader.result.split(',')[1];
        setImagenAdjunta({ url: reader.result, data: base64String });
      };
      reader.readAsDataURL(file);
    }
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  return (
    <div className="input-container">
      {archivo && (
        <div style={{width: '100%', maxWidth: '768px'}}>
          <div className="file-badge" style={{cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'}} onClick={subirArchivo}>
            <FileText size={14} /> {archivo.name} 
            <span style={{background: 'var(--text-primary)', color: 'var(--bg-main)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500', marginLeft: '4px'}}>
              {cargandoArchivo ? "Subiendo..." : "Subir archivo"}
            </span>
          </div>
        </div>
      )}

      {imagenAdjunta && (
        <div style={{width: '100%', maxWidth: '768px', marginBottom: '8px', position: 'relative', display: 'inline-block'}}>
          <img 
            src={imagenAdjunta.url} 
            alt="Preview" 
            style={{height: '60px', borderRadius: '8px', border: '2px solid var(--border-color)'}} 
          />
          <button 
            onClick={() => setImagenAdjunta(null)}
            style={{
              position: 'absolute', top: '-5px', right: '-5px', 
              background: '#ef4444', color: 'white', border: 'none', 
              borderRadius: '50%', width: '20px', height: '20px', 
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="input-box">
        <input
          ref={inputFileRef}
          className="hidden-file"
          type="file"
          accept=".txt,.pdf"
          onChange={(e) => setArchivo(e.target.files[0])}
          disabled={cargandoArchivo || respondiendo}
        />
        
        <input
          ref={imageInputRef}
          className="hidden-file"
          type="file"
          accept="image/*"
          onChange={manejarSubidaImagen}
          disabled={respondiendo}
          style={{ display: 'none' }}
        />

        <button
          className="attach-btn"
          onClick={() => imageInputRef.current?.click()}
          disabled={respondiendo}
          title="Adjuntar imagen"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Camera size={20} color="var(--text-secondary)" />
        </button>
        
        <button
          className="attach-btn"
          onClick={() => inputFileRef.current?.click()}
          disabled={cargandoArchivo || respondiendo}
          title="Adjuntar archivo"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Paperclip size={20} color="var(--text-secondary)" />
        </button>

        <input
          type="text"
          placeholder={
            escuchando
              ? "Te escucho..."
              : respondiendo
              ? "Pensando..."
              : archivoDelChat
              ? "Pregunta sobre el archivo..."
              : "Pregunta lo que quieras"
          }
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          onKeyDown={manejarEnter}
          disabled={respondiendo}
        />

        <button
          className={`mic-btn ${escuchando ? 'recording' : ''}`}
          onClick={toggleEscuchar}
          disabled={respondiendo}
          title="Dictado por voz"
          style={{
            background: 'transparent',
            border: 'none',
            color: escuchando ? '#ef4444' : 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '8px',
            marginRight: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s',
            animation: escuchando ? 'pulse 1.5s infinite' : 'none'
          }}
        >
          <Mic size={20} />
        </button>

        {respondiendo ? (
          <button
            className="send-btn stop-btn"
            onClick={detenerGeneracion}
            title="Detener respuesta"
            style={{ backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Square size={20} fill="var(--text-primary)" color="var(--text-primary)" />
          </button>
        ) : (
          <button
            className="send-btn"
            onClick={enviarMensaje}
            disabled={mensaje.trim() === "" && !archivo && !imagenAdjunta}
            title="Enviar mensaje"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowUp size={20} />
          </button>
        )}
      </div>
      
      <div className="disclaimer">
        La Inteligencia Artificial puede cometer errores. Considera verificar la información importante.
      </div>
    </div>
  );
};

export default ChatInput;
