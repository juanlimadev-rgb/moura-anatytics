require('dotenv').config();
const mysql = require('mysql2');

const pool = mysql.createPool({
  uri: process.env.MYSQL_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
});

// teste de conexão
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Erro ao conectar no MySQL:', err.message);
    return;
  }

  console.log('Conectado ao MySQL com sucesso!');
  connection.release();
});

module.exports = pool;