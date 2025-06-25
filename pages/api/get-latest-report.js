// pages/api/get-latest-report.js (Phiên bản cuối cùng, đã sửa lỗi JSON.parse)
import { sql } from '@vercel/postgres';

// Hàm này dùng để phân tích và lọc dữ liệu một cách an toàn
function parseAndFilterReportData(raw_data_from_db) {
    // 1. Kiểm tra xem dữ liệu có bị rỗng (null) không
    if (!raw_data_from_db) {
        throw new Error('Dữ liệu thô của báo cáo mới nhất trong database bị rỗng (null). Vui lòng upload lại báo cáo đó.');
    }

    // 2. Dữ liệu từ Vercel Postgres đã là một đối tượng JavaScript, không cần JSON.parse nữa
    const allData = raw_data_from_db;

    // 3. Kiểm tra cấu trúc dữ liệu cơ bản
    if (!Array.isArray(allData) || allData.length === 0 || !Array.isArray(allData[0])) {
        throw new Error('Dữ liệu báo cáo không có cấu trúc hợp lệ (không phải là bảng). Vui lòng kiểm tra lại file Excel.');
    }

    const originalHeaders = allData[0].map(h => String(h || '').trim());
    const desiredHeaders = ['STT', 'CÔNG VIỆC', 'LÝ TRÌNH', 'ĐƠN VỊ', '% Hoàn thành trong tuần', '% Hoàn thiện theo dự án', 'Ghi chú'];
    
    // 4. Tìm các cột cần thiết và báo lỗi cụ thể nếu thiếu
    const indicesToKeep = desiredHeaders.map(dh => {
        const index = originalHeaders.findIndex(oh => oh.toUpperCase() === dh.toUpperCase());
        if (index === -1) {
            throw new Error(`Cột bắt buộc "${dh}" không được tìm thấy trong tiêu đề của file Excel. Vui lòng kiểm tra lại báo cáo mới nhất.`);
        }
        return index;
    });

    // 5. Lọc dữ liệu
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
      conclusion: '',
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