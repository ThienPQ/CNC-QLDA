import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';

export default function handler(req, res) {
  try {
    const folder = path.join(process.cwd(), 'uploads');
    const files = ['bao cao tuan.xlsx', 'Bao cao tuan 3 T6.xlsx'].map(f => path.join(folder, f));
    let allTasks = [];

    files.forEach((filePath, idx) => {
      if (fs.existsSync(filePath)) {
        const workbook = xlsx.readFile(filePath);
        // Lấy sheet có chữ 'BC tuần' (nếu có) hoặc sheet đầu
        const sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('bc tuần')) || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Lấy vùng dòng 34 đến 90 (A34:Q90), điều chỉnh nếu khác!
        for (let i = 33; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[1]) continue;
          allTasks.push({
            line_name: row[2] || '',
            task_name: row[1] || '',
            unit: row[4] || '',
            volume_now: row[7] || '',
            volume_total: row[8] || '',
            percent: row[10] || '',
            note: row[11] || '',
            week: idx + 1
          });
        }
      }
    });

    res.status(200).json({ tasks: allTasks });
  } catch (error) {
    res.status(500).json({ error: 'Không đọc được báo cáo tuần', detail: error.message });
  }
}
