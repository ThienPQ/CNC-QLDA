// pages/api/check-duplicate-report.js
import db from '../../lib/db';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { fromDate, toDate, tuyen } = req.body;

  const query = `
    SELECT * FROM reports 
    WHERE tuyen = ? AND fromDate = ? AND toDate = ?
  `;

  db.get(query, [tuyen, fromDate, toDate], (err, row) => {
    if (err) {
      console.error('Lỗi kiểm tra trùng ngày:', err.message);
      return res.status(500).json({ message: 'Lỗi kiểm tra trùng ngày' });
    }

    if (row) {
      return res.status(200).json({ duplicated: true });
    }

    return res.status(200).json({ duplicated: false });
  });
}
