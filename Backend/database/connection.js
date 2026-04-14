require('dotenv').config();
const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  charset: 'utf8mb4',
  timezone: '-03:00'
});

connection.connect((err) => {
  if (err) {
    console.error('Erro ao conectar no MySQL:', err.message);
    return;
  }

  console.log('Conectado ao MySQL com sucesso!');
});

connection.on('error', (err) => {
  console.error('Erro na conexão MySQL:', err.message);
});

module.exports = connection;