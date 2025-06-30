// pages/api/get-weekly-reports.js
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_oMpHF1ezSvD3@ep-floral-pine-a4gxll7g-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
});

export default async function handler(req, res) {
  try {
    const { fromDate, toDate } = req.query;
    let query = 'SELECT * FROM weekly_reports';
    let params = [];

    if (fromDate && toDate) {
      query += ' WHERE from_date >= $1 AND to_date <= $2';
      params = [fromDate, toDate];
    }

    const { rows } = await pool.query(query, params);
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
