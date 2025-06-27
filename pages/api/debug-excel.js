// pages/api/debug-excel.js
import { v2 as cloudinary } from 'cloudinary';
import https from 'https';
import xlsx from 'xlsx';

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Hàm tải file từ Cloudinary về dưới dạng buffer
function downloadFileFromCloudinary(publicId) {
    const url = cloudinary.url(publicId, { resource_type: 'raw' });
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Không tìm thấy file trên Cloudinary (status code: ${res.statusCode})`));
            }
            const data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
            res.on('error', err => reject(err));
        }).on('error', err => reject(err));
    });
}

export default async function handler(req, res) {
  try {
    // 1. Tải file PLHD.xlsx trực tiếp từ Cloudinary
    const buffer = await downloadFileFromCloudinary('PLHD.xlsx');
    
    // 2. Đọc file Excel từ buffer trong bộ nhớ
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    
    // 3. Chọn đúng sheet "Mẫu số 11C"
    const sheetName = 'Mẫu số 11C';
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return res.status(404).json({ error: `Không tìm thấy sheet có tên '${sheetName}' trong file PLHD.xlsx trên Cloudinary.` });
    }

    // 4. Chuyển toàn bộ sheet thành một mảng của các mảng (dữ liệu thô nhất có thể)
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // 5. Trả về toàn bộ dữ liệu thô này cho trang debug
    res.status(200).json({
      sheetName: sheetName,
      data: rawData,
    });

  } catch (error) {
    console.error("Lỗi nghiêm trọng khi debug file Excel:", error);
    res.status(500).json({ error: 'Không thể đọc và phân tích file Excel từ Cloudinary.', details: error.message });
  }
}