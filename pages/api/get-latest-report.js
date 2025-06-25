// pages/api/get-latest-report.js
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    // Truy vấn báo cáo mới nhất từ database
    const { rows } = await sql`
      SELECT report_data, conclusion, recommendation 
      FROM reports 
      ORDER BY created_at DESC 
      LIMIT 1;
    `;

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Không có dữ liệu báo cáo trong database.' });
    }

    const latestReport = rows[0];
    
    // Trả về dữ liệu đã được lưu
    res.status(200).json({
      rows: latestReport.report_data,
      conclusion: latestReport.conclusion,
      recommendation: latestReport.recommendation,
    });

  } catch (error) {
    // Xử lý trường hợp bảng chưa được tạo
    if (error.message.includes('relation "reports" does not exist')) {
        return res.status(404).json({ error: 'Chưa có báo cáo nào được upload và lưu vào database.' });
    }
    console.error('Lỗi khi truy vấn database:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy dữ liệu báo cáo.' });
  }
}