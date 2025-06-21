// lib/db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Cannot connect to SQLite database:', err.message);
  } else {
    console.log('✅ Connected to SQLite database.');
  }
});

module.exports = db;
