const fs = require("fs");
const mysql = require("mysql2");

const sql = fs.readFileSync("banco_limpo.sql", "utf8");

// Cole aqui a Connection URL completa do Railway
const databaseUrl =
  "mysql://root:MPLUMVFJKlupOmmHQuIgtAWpUoHqNpBm@monorail.proxy.rlwy.net:14649/railway";

const connection = mysql.createConnection({
  uri: databaseUrl,
  multipleStatements: true,
  ssl: {
    rejectUnauthorized: false
  }
});

connection.connect((err) => {
  if (err) {
    console.error("Erro ao conectar:", err.message);
    return;
  }

  console.log("Conectado ao Railway MySQL.");

  connection.query(sql, (error) => {
    if (error) {
      console.error("Erro ao importar SQL:", error.message);
    } else {
      console.log("Estrutura importada com sucesso.");
    }

    connection.end();
  });
});