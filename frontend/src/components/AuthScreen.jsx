import React, { useState } from 'react';
import { User, Lock, ArrowRight, Sparkles } from 'lucide-react';
import './AuthScreen.css';

const AuthScreen = ({ setToken, setUser }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
    const url = isLogin ? `${API_URL}/api/login` : `${API_URL}/api/register`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió un error en el servidor');
      }

      if (isLogin) {
        localStorage.setItem('chatbot_token', data.token);
        localStorage.setItem('chatbot_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
      } else {
        setIsLogin(true);
        setError('¡Cuenta creada con éxito! Ahora puedes iniciar sesión.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-container">
            <Sparkles size={32} className="auth-logo" />
          </div>
          <h2>Ollama Bot</h2>
          <p>{isLogin ? 'Bienvenido de vuelta al futuro' : 'Únete a la revolución de la IA'}</p>
        </div>

        {error && <div className={`auth-alert ${error.includes('éxito') ? 'success' : 'error'}`}>{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Usuario</label>
            <div className="input-with-icon">
              <User size={18} className="input-icon" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej: admin"
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Procesando...' : (
              <>
                {isLogin ? 'Iniciar Sesión' : 'Registrarse'} <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes una cuenta?'}
            <span onClick={() => { setIsLogin(!isLogin); setError(''); }}>
              {isLogin ? ' Regístrate' : ' Inicia sesión'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
