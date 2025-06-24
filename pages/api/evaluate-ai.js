// pages/api/evaluate-ai.js
import axios from 'axios';
import xlsx from 'xlsx';
import OpenAI from 'openai';

// ... (phần khởi tạo OpenAI và hàm formatDataForPrompt giữ nguyên)

export default async function handler(req, res) {
  // ...
  try {
    // ...
    // THAY ĐỔI PHẦN ĐỌC FILE PLHD.XLSX
    let contractPlanData = [];
    try {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const fileUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/PLHD.xlsx`;
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const workbook = xlsx.read(response.data, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        contractPlanData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } catch (e) {
      if (e.response && e.response.status === 404) {
        return res.status(404).json({ error: 'Chưa có file "PLHD.xlsx" nào được tải lên. Vui lòng vào trang /upload để tải lên.' });
      }
      console.error("Không thể đọc file PLHD.xlsx từ Cloudinary: ", e);
      return res.status(500).json({ error: 'Lỗi khi đọc file kế hoạch từ Cloudinary.' });
    }
    
    // ... (toàn bộ phần code còn lại để xây dựng prompt và gọi OpenAI giữ nguyên)
    // ...

  } catch (error) {
    console.error('Lỗi từ API của OpenAI:', error);
    res.status(500).json({ error: 'Không thể nhận được đánh giá từ OpenAI.', details: error.message });
  }
}