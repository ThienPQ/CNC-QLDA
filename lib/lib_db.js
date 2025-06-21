
// lib/db.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { join } from 'path';

export async function openDB() {
  const db = await open({
    filename: join(process.cwd(), 'database.sqlite'),
    driver: sqlite3.Database
  });

  await db.exec(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tuyen TEXT,
    khoiLuong TEXT,
    tienDo TEXT,
    giaTriThanhToan TEXT,
    ghiChu TEXT,
    fromDate TEXT,
    toDate TEXT
  );`);

  return db;
}
