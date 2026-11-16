CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE partidas (
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
CREATE TABLE eventos_partida (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_partida INTEGER,
    id_atleta INTEGER,
    set_numero INTEGER,
    fundamento TEXT,
    resultado TEXT,
    data_evento DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE sets_partida (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_partida INTEGER,
    set_numero INTEGER,
    pontos_dupla INTEGER,
    pontos_adversario INTEGER
);
CREATE TABLE atletas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    pais TEXT,
    altura REAL,
    idade INTEGER,
    dupla TEXT
);
