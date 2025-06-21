// pages/api/save-report.js
import db from '@/lib/db';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  console.log('✅ Connected to SQLite database.');
  console.log('Body:', req.body);

  const { data, fromDate, toDate } = req.body;

  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ message: 'Invalid data format' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO reports (tuyen, khoiLuong, tienDo, giaTriThanhToan, ghiChu, fromDate, toDate)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    data.forEach((report) => {
      stmt.run([
        report.tenTuyen,
        report.khoiLuong || null,
        report.tienDo || null,
        report.giaTriThanhToan || null,
        report.ghiChu || '',
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
