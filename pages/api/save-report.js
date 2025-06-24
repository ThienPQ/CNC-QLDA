// pages/api/save-report.js
import db from '@/lib/db';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { data, fromDate, toDate } = req.body;

  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ message: 'Invalid data format' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO reports (stt, ten_hang_muc, don_vi, khoi_luong_thuc_hien, ghi_chu, fromDate, toDate)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    data.forEach((item) => {
      stmt.run([
        item.stt,
        item.ten,
        item.don_vi,
        item.khoi_luong_thuc_hien || null,
        item.ghi_chu || '',
        fromDate,
        toDate
      ]);
    });

    return res.status(200).json({ message: 'Dữ liệu đã được lưu' });
  } catch (error) {
    console.error('Lỗi lưu dữ liệu:', error);
    return res.status(500).json({ message: 'Lỗi lưu dữ liệu' });
  }
}
