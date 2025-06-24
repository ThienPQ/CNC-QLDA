// pages/api/get-latest-report.js
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

export default function handler(req, res) {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const files = fs.readdirSync(uploadsDir)
      .filter(f => f.endsWith('.xlsx'))
      .sort((a, b) => fs.statSync(path.join(uploadsDir, b)).mtime - fs.statSync(path.join(uploadsDir, a)).mtime);

    if (files.length === 0) return res.status(404).json({ error: 'Không có báo cáo' });

    const latestFile = path.join(uploadsDir, files[0]);
    const workbook = xlsx.readFile(latestFile);

    const sheetNames = workbook.SheetNames.filter(name => name.toLowerCase().includes('bc tuần'));
    const sheet = workbook.Sheets[sheetNames[sheetNames.length - 1]];
    const data = xlsx.utils.sheet_to_json(sheet, { range: 33 });

    res.status(200).json(data);
  } catch (err) {
    console.error('Lỗi xử lý file:', err);
    res.status(500).json({ error: 'Lỗi khi đọc báo cáo' });
  }
}
