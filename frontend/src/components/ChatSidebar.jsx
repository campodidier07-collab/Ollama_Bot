import React, { useState } from "react";
import { Plus, PanelLeftClose, Search, X, Pencil, Trash2, LogOut, Sun, Moon, User } from "lucide-react";

const ChatSidebar = ({
  mostrarChats,
  setMostrarChats,
  chats,
  chatActivo,
  setChatActivo,
  nuevoChat,
  limpiarChat,
  eliminarChat,
  renombrarChat,
  archivoDelChat,
  eliminarArchivoDelChat,
  temaOscuro,
  setTemaOscuro,
  user,
  onLogout
}) => {
  const [buscando, setBuscando] = useState(false);
  const [textoBusqueda, setTextoBusqueda] = useState("");
  
  const [editandoId, setEditandoId] = useState(null);
  const [tituloEditado, setTituloEditado] = useState("");

  if (!mostrarChats) return null;

  const chatsFiltrados = chats.filter((chat) => {
    if (!textoBusqueda.trim()) return true;
    
    const busqueda = textoBusqueda.toLowerCase();
    
    // Buscar por título del chat
    if (chat.titulo.toLowerCase().includes(busqueda)) return true;
    
    // Buscar dentro del contenido de los mensajes
    const contieneMensaje = chat.mensajes.some(msg => 
      msg.texto.toLowerCase().includes(busqueda)
    );
    
    return contieneMensaje;
  });

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <button className="new-chat-btn" onClick={nuevoChat} style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          <Plus size={18} /> Nuevo chat
        </button>
        <button 
          className="close-sidebar-btn" 
          title="Cerrar barra lateral" 
          onClick={() => setMostrarChats(false)}
          style={{display: 'flex', alignItems: 'center'}}
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      <div className="sidebar-menu-items">
        {buscando ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            background: 'var(--bg-input)', 
            padding: '6px 12px', 
            borderRadius: '8px', 
            marginBottom: '2px',
            border: '1px solid var(--border-color)'
          }}>
            <Search size={14} style={{marginRight: '8px', color: 'var(--text-secondary)'}} />
            <input 
              autoFocus
              type="text" 
              placeholder="Buscar chats..." 
              value={textoBusqueda}
              onChange={(e) => setTextoBusqueda(e.target.value)}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'var(--text-primary)', 
                outline: 'none', 
                width: '100%',
                fontSize: '14px'
              }}
            />
            <button 
              onClick={() => { setBuscando(false); setTextoBusqueda(""); }} 
              style={{padding: '0', marginLeft: '4px', background: 'transparent', display: 'flex'}}
            >
              <X size={14} color="var(--text-secondary)" />
            </button>
          </div>
        ) : (
          <button onClick={() => setBuscando(true)} style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
            <Search size={14} /> Buscar chats
          </button>
        )}
      </div>

      <div className="chat-history">
        <div className="chat-history-title">
          {textoBusqueda.trim() ? "Resultados de búsqueda" : "Hoy"}
        </div>
        
        {chatsFiltrados.length === 0 && textoBusqueda.trim() && (
          <div style={{padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)'}}>
            No se encontraron resultados
          </div>
        )}

        {chatsFiltrados.map((chat) => (
          <div key={chat.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
            {editandoId === chat.id ? (
              <div style={{ display: 'flex', flex: 1, padding: '4px 8px', background: 'var(--bg-input)', borderRadius: '8px' }}>
                <input
                  autoFocus
                  type="text"
                  value={tituloEditado}
                  onChange={(e) => setTituloEditado(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      renombrarChat(chat.id, tituloEditado);
                      setEditandoId(null);
                    }
                  }}
                  onBlur={() => {
                    renombrarChat(chat.id, tituloEditado);
                    setEditandoId(null);
                  }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '14px' }}
                />
              </div>
            ) : (
              <button
                className={chat.id === chatActivo ? "active" : ""}
                onClick={() => setChatActivo(chat.id)}
                style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '4px' }}
              >
                {chat.titulo}
              </button>
            )}
            
            {editandoId !== chat.id && (
              <div style={{ display: 'flex', flexShrink: 0 }}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setTituloEditado(chat.titulo);
                    setEditandoId(chat.id);
                  }}
                  style={{ padding: '10px 4px', background: 'transparent', width: 'auto', display: 'flex' }}
                  title="Renombrar chat"
                >
                  <Pencil size={14} color="var(--text-secondary)" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    eliminarChat(chat.id);
                  }}
                  style={{ padding: '10px 4px', background: 'transparent', width: 'auto', display: 'flex' }}
                  title="Eliminar chat"
                >
                  <Trash2 size={14} color="var(--text-secondary)" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="user-info" style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="user-avatar" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={16} />
              </div>
              <span className="user-name">{user?.username || "Usuario"}</span>
            </div>
            <button 
              onClick={onLogout}
              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Cerrar sesión"
            >
              <LogOut size={14} /> Salir
            </button>
          </div>
          <button 
            onClick={() => setTemaOscuro(!temaOscuro)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--bg-input)', border: 'none', color: 'var(--text-primary)', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
          >
            {temaOscuro ? <Sun size={14} /> : <Moon size={14} />} {temaOscuro ? "Cambiar a Claro" : "Cambiar a Oscuro"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;
