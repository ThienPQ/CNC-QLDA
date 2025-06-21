// pages/api/fetch-reports.js
import db from '@/lib/db';

// Hàm mô phỏng tiến độ hợp đồng
function getContractProgress(tuyen, toDate) {
  // TODO: Cập nhật tiến độ thực tế theo hợp đồng nếu có
  return 10; // mặc định tạm
}

export default async function handler(req, res) {
  try {
    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM reports', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const reports = rows.map((row) => {
      const tienDo = parseFloat(row.tienDo || '0');
      const tienDoHopDong = getContractProgress(row.tuyen, row.toDate);
      const diff = tienDo - tienDoHopDong;
      const danhGia =
        diff > 0 ? 'Nhanh tiến độ' : diff < 0 ? 'Chậm tiến độ' : 'Đúng tiến độ';

      return {
        ...row,
        tienDo,
        tienDoHopDong,
        danhGia,
      };
    });

    res.status(200).json(reports);
  } catch (err) {
    console.error('Lỗi khi lấy báo cáo:', err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
}
