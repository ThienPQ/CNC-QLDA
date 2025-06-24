// pages/api/get-latest-report.js (Phiên bản cho Cloudinary)
import axios from 'axios';
import xlsx from 'xlsx';

export default async function handler(req, res) {
  try {
    // Xây dựng URL trực tiếp đến file trên Cloudinary
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const fileUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/bao-cao-tuan.xlsx`;

    // Dùng axios để tải file về dưới dạng buffer
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const buffer = response.data;
    
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    
    const filteredSheetNames = workbook.SheetNames.filter(name => !/^Sheet\d+$/i.test(name));
    if (filteredSheetNames.length === 0) {
        return res.status(404).json({ error: 'Không tìm thấy sheet báo cáo hợp lệ nào trong file báo cáo.' });
    }

    const targetSheetName = filteredSheetNames[filteredSheetNames.length - 1];
    const sheet = workbook.Sheets[targetSheetName];
    if (!sheet) {
        return res.status(404).json({ error: `Không thể đọc được sheet '${targetSheetName}'.` });
    }

    // Logic xử lý dữ liệu trong sheet
    const tableData = xlsx.utils.sheet_to_json(sheet, { range: 'A34:Q90', header: 1 });
    let tableRows = [];
    if (tableData.length > 0) {
      const headers = tableData[0];
      tableRows = tableData.slice(1).map(row => {
        const obj = {};
        headers.forEach((header, i) => { if (header) { obj[String(header)] = row[i] || ''; } });
        return obj;
      }).filter(obj => Object.keys(obj).length > 0 && obj[Object.keys(obj)[0]] !== '');
    }

    const fullSheetData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    let conclusion = '';
    let recommendation = '';
    for (const row of fullSheetData) {
      if (row && typeof row[0] === 'string') {
        const firstCell = row[0].trim().toUpperCase();
        if (firstCell.includes('KẾT LUẬN')) { conclusion = row[1] || ''; }
        if (firstCell.includes('KIẾN NGHỊ')) { recommendation = row[1] || ''; }
      }
    }
    
    res.status(200).json({ rows: tableRows, conclusion, recommendation });

  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'Chưa có file "bao-cao-tuan.xlsx" nào được tải lên. Vui lòng vào trang upload để tải lên.' });
    }
    console.error('Lỗi khi đọc file từ Cloudinary:', error);
    res.status(500).json({ error: 'Lỗi server khi xử lý file báo cáo.' });
  }
}