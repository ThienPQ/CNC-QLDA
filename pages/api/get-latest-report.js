import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  console.log("[GET-API] Bắt đầu lấy báo cáo.");
  try {
    const { rows } = await sql`SELECT headers_data, report_data, conclusion, recommendation FROM reports ORDER BY created_at DESC LIMIT 1;`;

    if (rows.length === 0) {
      console.log("[GET-API] Không tìm thấy báo cáo nào trong DB.");
      return res.status(404).json({ error: 'Không có dữ liệu báo cáo trong database.' });
    }

    const latestReport = rows[0];
    
    // --- LOG ĐỂ DEBUG ---
    console.log("[GET-API] Headers lấy từ DB:", JSON.stringify(latestReport.headers_data));
    console.log("[GET-API] Dòng dữ liệu đầu tiên lấy từ DB:", JSON.stringify(latestReport.report_data[0]));
    // --- KẾT THÚC LOG ---

    res.status(200).json({
      headers: latestReport.headers_data || [],
      rows: latestReport.report_data || [],
      conclusion: latestReport.conclusion,
      recommendation: latestReport.recommendation,
    });

  } catch (error) {
    console.error('[GET-API] Lỗi khi truy vấn database:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy dữ liệu báo cáo.' });
  }
}