// pages/api/get-latest-report.js
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    // Truy vấn thêm cả headers_data
    const { rows } = await sql`
      SELECT headers_data, report_data, conclusion, recommendation 
      FROM reports 
      ORDER BY created_at DESC 
      LIMIT 1;
    `;

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Không có dữ liệu báo cáo trong database.' });
    }

    const latestReport = rows[0];
    
    // Trả về dữ liệu bao gồm cả headers
    res.status(200).json({
      headers: latestReport.headers_data || Object.keys(latestReport.report_data[0] || {}), // Dự phòng nếu header null
      rows: latestReport.report_data,
      conclusion: latestReport.conclusion,
      recommendation: latestReport.recommendation,
    });

  } catch (error) {
    if (error.message.includes('relation "reports" does not exist')) {
        return res.status(404).json({ error: 'Chưa có báo cáo nào được upload và lưu vào database.' });
    }
    console.error('Lỗi khi truy vấn database:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy dữ liệu báo cáo.' });
  }
}