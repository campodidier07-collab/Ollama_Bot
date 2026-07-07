const pool = require('./db');

async function test() {
  try {
    const [chats] = await pool.query('SELECT * FROM chats');
    console.log("Total chats in DB:", chats.length);
    if (chats.length > 0) {
      console.log("Sample chat:", {
        id: chats[0].id,
        user_id: chats[0].user_id,
        titulo: chats[0].titulo,
        mensajesCount: chats[0].mensajes ? chats[0].mensajes.length : 0
      });
    }
    const [users] = await pool.query('SELECT * FROM users');
    console.log("Total users in DB:", users.length);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
test();
