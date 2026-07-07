require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chatbot_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Aiven requiere SSL
  ssl: process.env.DB_HOST?.includes('aivencloud') ? { rejectUnauthorized: false } : undefined
});

async function initDB() {
  try {
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
