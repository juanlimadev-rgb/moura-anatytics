const Database = require("better-sqlite3");
const {dbPath} = require('../paths');
const db = new Database(dbPath);
db.pragma('busy_timeout = 5000');

module.exports = db;
