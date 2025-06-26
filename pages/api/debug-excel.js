// pages/api/debug-excel.js
import { v2 as cloudinary } from 'cloudinary';
import xlsx from 'xlsx';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Hàm tải file từ Cloudinary về
async function downloadFileFromCloudinary(publicId) {
    const url = cloudinary.url(publicId, { resource_type: 'raw' });
    const https = require('https');
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
            res.on('error', err => reject(err));
        });
    });
}

export default async function handler(req, res) {
  try {
    // Tải file PLHD.xlsx từ Cloudinary
    const buffer = await downloadFileFromCloudinary('PLHD.xlsx');
    
    // Đọc file Excel từ buffer
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    
    // Chọn đúng sheet "Mẫu số 11C"
    const sheetName = 'Mẫu số 11C';
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return res.status(404).json({ error: `Không tìm thấy sheet có tên '${sheetName}' trong file PLHD.xlsx` });
    }

    // Chuyển toàn bộ sheet thành một mảng của các mảng (dữ liệu thô)
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // Trả về toàn bộ dữ liệu thô này
    res.status(200).json({
      sheetName: sheetName,
      data: rawData,
    });

  } catch (error) {
    console.error("Lỗi khi debug file Excel:", error);
    res.status(500).json({ error: 'Không thể đọc và phân tích file Excel.', details: error.message });
  }
}