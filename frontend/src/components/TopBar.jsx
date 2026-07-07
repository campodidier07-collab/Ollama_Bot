import React from "react";
import { Menu, MessageSquare, Printer } from "lucide-react";

const TopBar = ({ mostrarChats, setMostrarChats, chatTitulo, numMensajes }) => {
  return (
    <div className="top-bar">
      <div className="top-bar-title" onClick={() => setMostrarChats(!mostrarChats)}>
        <Menu size={20} /> 
        <strong style={{ marginLeft: '8px' }}>{chatTitulo || "Nuevo chat"}</strong>
      </div>
      
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }} title="Mensajes en el contexto actual">
          <MessageSquare size={14} /> {numMensajes}
        </span>
        <button 
          className="export-btn"
          onClick={() => window.print()}
          title="Exportar a PDF"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Printer size={18} />
        </button>
      </div>
    </div>
  );
};

export default TopBar;
