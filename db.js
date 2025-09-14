
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const dbPath = path.join(dataDir, 'budget.db');
const db = new Database(dbPath);


db.prepare(`
  CREATE TABLE IF NOT EXISTS income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'one-time', -- one-time | daily | monthly
    date TEXT NOT NULL,
    notes TEXT
  )
`).run();


db.prepare(`
  CREATE TABLE IF NOT EXISTS expense (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    notes TEXT
  )
`).run();


db.prepare(`
  CREATE TABLE IF NOT EXISTS budget (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT DEFAULT NULL,        -- format YYYY-MM or NULL for default recurring
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    UNIQUE(month, category)
  )
`).run();


module.exports = db;
