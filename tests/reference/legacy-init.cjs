const db = require("./connection");

// Usuários
db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// Partidas
db.exec(`
CREATE TABLE IF NOT EXISTS partidas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_partida TEXT,
    adversario TEXT,
    campeonato TEXT,
    local TEXT,
    resultado TEXT,
    dupla TEXT,
    atleta1 TEXT,
    atleta2 TEXT,
    id_usuario INTEGER
);
`);

// Eventos
db.exec(`
CREATE TABLE IF NOT EXISTS eventos_partida (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_partida INTEGER,
    id_atleta INTEGER,
    set_numero INTEGER,
    fundamento TEXT,
    resultado TEXT,
    data_evento DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// Sets
db.exec(`
CREATE TABLE IF NOT EXISTS sets_partida (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_partida INTEGER,
    set_numero INTEGER,
    pontos_dupla INTEGER,
    pontos_adversario INTEGER
);
`);

// Atletas
db.exec(`
CREATE TABLE IF NOT EXISTS atletas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    pais TEXT,
    altura REAL,
    idade INTEGER,
    dupla TEXT
);
`);

console.log("✅ Tabelas SQLite criadas com sucesso.");
