// lib/mysql.js
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'mysql.railway.internal',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'YsRNSceRdYjeEzfBAWEaYdDMENGjBTdx',
  database: process.env.MYSQL_DATABASE || 'railway',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
