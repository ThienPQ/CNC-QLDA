// pages/api/get-weekly-reports.js

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  try {
    const { from_date, to_date } = req.query;
    // Lấy dữ liệu weekly_reports theo khoảng ngày
    const result = await pool.query(
      `SELECT * FROM weekly_reports WHERE from_date >= $1 AND to_date <= $2`,
      [from_date, to_date]
    );
    // Lấy dữ liệu hợp đồng (project_tasks)
    const taskResult = await pool.query(`SELECT * FROM project_tasks`);
    res.status(200).json({
      reports: result.rows,
      tasks: taskResult.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi truy vấn dữ liệu", detail: err.message });
  }
}
