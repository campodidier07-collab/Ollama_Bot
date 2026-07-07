const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // Laragon por defecto no tiene contraseña
  database: 'chatbot_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initDB() {
  try {
    // 1. Conectarnos sin especificar base de datos para crearla si no existe
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: ''
    });
    
    await connection.query(`CREATE DATABASE IF NOT EXISTS chatbot_db;`);
    await connection.end();

    // 2. Crear las tablas en la base de datos chatbot_db
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createChatsTable = `
      CREATE TABLE IF NOT EXISTS chats (
        id VARCHAR(100) PRIMARY KEY,
        user_id INT NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        mensajes JSON,
        archivo JSON,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `;

    await pool.query(createUsersTable);
    await pool.query(createChatsTable);

    console.log('✅ Base de datos MySQL inicializada correctamente.');
  } catch (error) {
    console.error('❌ Error inicializando la base de datos MySQL:', error.message);
  }
}

initDB();

module.exports = pool;
