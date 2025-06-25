// pages/api/get-latest-report.js (Phiên bản mạnh mẽ, chống lỗi dữ liệu)
import { sql } from '@vercel/postgres';

// Hàm này dùng để phân tích và lọc dữ liệu một cách an toàn
function parseAndFilterReportData(raw_data) {
    // 1. Kiểm tra xem dữ liệu có bị rỗng (null) trước khi xử lý không
    if (!raw_data) {
        throw new Error('Dữ liệu thô của báo cáo mới nhất trong database bị rỗng (null). Vui lòng upload lại báo cáo đó.');
    }

    let allData;
    try {
        // 2. Thử phân tích chuỗi JSON, nếu lỗi, báo cho người dùng biết
        allData = JSON.parse(raw_data);
    } catch (e) {
        throw new Error('Không thể phân tích dữ liệu JSON từ database. Dữ liệu của báo cáo mới nhất có thể đã bị lỗi khi lưu.');
    }

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
            // Ném ra một lỗi rất cụ thể, cho biết chính xác cột nào bị thiếu
            throw new Error(`Cột bắt buộc "${dh}" không được tìm thấy trong tiêu đề của file Excel. Vui lòng kiểm tra lại báo cáo mới nhất.`);
        }
        return index;
    });

    // 5. Lọc dữ liệu một cách an toàn
    const newRowsAsArrays = allData.slice(1)
        .filter(row => Array.isArray(row) && row.length > 0 && String(row[0] || '').trim() !== '')
        .map(row => indicesToKeep.map(index => row[index]));
    
    return { headers: desiredHeaders, rows: newRowsAsArrays };
}


export default async function handler(req, res) {
  try {
    // Lấy ra báo cáo mới nhất để hiển thị
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
    
    // Phân tích dữ liệu bằng hàm đã được nâng cấp
    const parsedData = parseAndFilterReportData(latestReportRawData);
    
    // Trả về dữ liệu đã được lọc và làm sạch cho giao diện
    res.status(200).json({
      headers: parsedData.headers,
      rows: parsedData.rows,
      conclusion: '',
      recommendation: '',
    });
  } catch (error) {
    // Khối catch này giờ sẽ nhận được các thông báo lỗi cụ thể hơn từ hàm parse
    console.error('Lỗi nghiêm trọng trong API get-latest-report:', error.message);
    
    if (error.message.includes('relation "reports" does not exist')) {
        return res.status(404).json({ error: 'Chưa có báo cáo nào được upload.' });
    }

    // Trả về thông báo lỗi cụ thể đó cho người dùng
    res.status(500).json({ error: error.message });
  }
}