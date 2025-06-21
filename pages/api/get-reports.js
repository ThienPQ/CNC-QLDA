import db from '@/lib/db';

export default function handler(req, res) {
  const { fromDate, toDate } = req.query;

  try {
    const stmt = db.prepare(`
      SELECT * FROM reports 
      WHERE fromDate >= ? AND toDate <= ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(fromDate, toDate);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu:', error);
    res.status(500).json({ success: false, error: 'Lỗi server' });
  }
}
