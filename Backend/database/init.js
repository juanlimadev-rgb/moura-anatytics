const db = require('./connection');
require('./migrate').migrate(db);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
module.exports = db;
