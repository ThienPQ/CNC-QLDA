import { sql } from '@vercel/postgres';
import xlsx from 'xlsx';

// Hàm này sẽ phân tích dữ liệu thô từ DB thành 7 cột mong muốn
function parseReportData(raw_data) {
  const allData = JSON.parse(raw_data);
  const originalHeaders = allData[0].map(h => String(h || '').trim());
  const desiredHeaders = ['STT', 'CÔNG VIỆC', 'LÝ TRÌNH', 'ĐƠN VỊ', '% Hoàn thành trong tuần', '% Hoàn thiện theo dự án', 'Ghi chú'];
  
  const indicesToKeep = desiredHeaders.map(dh => {
    const index = originalHeaders.findIndex(oh => oh.toUpperCase() === dh.toUpperCase());
    if (index === -1) throw new Error(`Cột "${dh}" không tìm thấy.`);
    return index;
  });

  const newRowsAsArrays = allData.slice(1)
      .filter(row => row.length > 0 && String(row[0] || '').trim() !== '')
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
    const parsedData = parseReportData(latestReportRawData);
    
    res.status(200).json({
      headers: parsedData.headers,
      rows: parsedData.rows,
      // Không còn kết luận và kiến nghị ở giai đoạn này
      conclusion: '',
      recommendation: '',
    });
  } catch (error) {
    if (error.message.includes('relation "reports" does not exist')) {
        return res.status(404).json({ error: 'Chưa có báo cáo nào được upload.' });
    }
    console.error('Lỗi khi lấy báo cáo mới nhất:', error);
    res.status(500).json({ error: 'Lỗi server khi lấy dữ liệu báo cáo.' });
  }
}