// pages/api/get-latest-report.js
import { sql } from '@vercel/postgres';

// Hàm này sẽ phân tích dữ liệu thô và lọc ra 7 cột cần thiết
function parseAndFilterReportData(raw_data_from_db) {
  if (!raw_data_from_db) {
    throw new Error('Dữ liệu thô của báo cáo trong database bị rỗng (null). Vui lòng upload lại báo cáo.');
  }

  const allData = raw_data_from_db; // Dữ liệu từ Vercel Postgres đã là object

  if (!Array.isArray(allData) || allData.length < 1 || !Array.isArray(allData[0])) {
    throw new Error('Dữ liệu báo cáo không có cấu trúc hợp lệ. Vui lòng kiểm tra lại file Excel.');
  }

  const originalHeaders = allData[0].map(h => String(h || '').trim());
  const desiredHeaders = ['STT', 'CÔNG VIỆC', 'LÝ TRÌNH', 'ĐƠN VỊ', '% Hoàn thành trong tuần', '% Hoàn thiện theo dự án', 'Ghi chú'];
  
  const indicesToKeep = desiredHeaders.map(dh => {
    const index = originalHeaders.findIndex(oh => oh.toUpperCase() === dh.toUpperCase());
    if (index === -1) {
      throw new Error(`Cột bắt buộc "${dh}" không được tìm thấy trong tiêu đề của file Excel.`);
    }
    return index;
  });

  const newRowsAsArrays = allData.slice(1)
      .filter(row => Array.isArray(row) && row.length > 0 && String(row[0] || '').trim() !== '')
      .map(row => indicesToKeep.map(index => row[index]));
  
  return { headers: desiredHeaders, rows: newRowsAsArrays };
}


export default async function handler(req, res) {
  try {
    const result = await sql`
      SELECT raw_data 
      FROM reports 
      ORDER BY week_end_date DESC, id DESC 
      LIMIT 1;
    `;

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không có dữ liệu báo cáo nào trong database.' });
    }

    const latestReportRawData = result.rows[0].raw_data;
    const parsedData = parseAndFilterReportData(latestReportRawData);
    
    res.status(200).json({
      headers: parsedData.headers,
      rows: parsedData.rows,
      conclusion: '', // Không còn kết luận/kiến nghị trong giao diện
      recommendation: '',
    });
  } catch (error) {
    console.error('Lỗi nghiêm trọng trong API get-latest-report:', error.message);
    if (error.message.includes('relation "reports" does not exist')) {
        return res.status(404).json({ error: 'Chưa có báo cáo nào được upload.' });
    }
    res.status(500).json({ error: error.message });
  }
}