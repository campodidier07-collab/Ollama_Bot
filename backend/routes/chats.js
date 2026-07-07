const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Obtener todos los chats del usuario
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM chats WHERE user_id = ? ORDER BY updated_at DESC', [req.user.id]);
    
    // Parsear el JSON
    const chatsFormateados = rows.map(chat => ({
      id: chat.id,
      titulo: chat.titulo,
      mensajes: chat.mensajes ? chat.mensajes : [],
      archivo: chat.archivo ? chat.archivo : null,
      updated_at: chat.updated_at
    }));

    res.json(chatsFormateados);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo chats' });
  }
});

// Crear un nuevo chat o guardar un chat existente
router.post('/', async (req, res) => {
  try {
    const { id, titulo, mensajes, archivo } = req.body;
    const userId = req.user.id;

    // Verificar si el chat ya existe
    const [existing] = await pool.query('SELECT id FROM chats WHERE id = ? AND user_id = ?', [id, userId]);

    if (existing.length > 0) {
      // Actualizar
      await pool.query(
        'UPDATE chats SET titulo = ?, mensajes = ?, archivo = ? WHERE id = ? AND user_id = ?',
        [titulo, JSON.stringify(mensajes), JSON.stringify(archivo), id, userId]
      );
    } else {
      // Crear
      await pool.query(
        'INSERT INTO chats (id, user_id, titulo, mensajes, archivo) VALUES (?, ?, ?, ?, ?)',
        [id, userId, titulo, JSON.stringify(mensajes), JSON.stringify(archivo)]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error guardando el chat' });
  }
});

// Eliminar un chat
router.delete('/:id', async (req, res) => {
  try {
    const chatId = req.params.id;
    await pool.query('DELETE FROM chats WHERE id = ? AND user_id = ?', [chatId, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando el chat' });
  }
});

module.exports = router;
