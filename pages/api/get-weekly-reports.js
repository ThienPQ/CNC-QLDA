// pages/api/get-weekly-reports.js
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    const result = await sql`
      SELECT stt, task_name, unit, volume_now, volume_total, percent, note, start_date, end_date
      FROM weekly_reports
      ORDER BY stt::text ASC;
    `;

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Lỗi khi truy vấn dữ liệu:', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi lấy báo cáo' });
  }
} 
