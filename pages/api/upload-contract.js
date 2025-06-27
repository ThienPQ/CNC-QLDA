// pages/api/upload-contract.js
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { sql } from '@vercel/postgres';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ hỗ trợ phương thức POST' });
  }

  const form = new formidable.IncomingForm();
  form.uploadDir = path.join(process.cwd(), '/uploads');
  form.keepExtensions = true;

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Lỗi khi xử lý tệp' });

    const file = files.file;
    if (!file) return res.status(400).json({ error: 'Không có tệp được tải lên' });

    const originalFileName = file.originalFilename || file.newFilename;
    const savedPath = path.join(form.uploadDir, originalFileName);
    fs.renameSync(file.filepath, savedPath);

    // Đọc file PLHD
    const xlsx = await import('xlsx');
    const workbook = xlsx.readFile(savedPath);
    const sheet = workbook.Sheets['Mẫu số 11C'];
    if (!sheet) return res.status(400).json({ error: 'Không tìm thấy sheet "Mẫu số 11C"' });

    const raw = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    let currentGroup = null;
    let currentCategory = null;

    for (let i = 6; i < raw.length; i++) {
      const row = raw[i];
      const stt = row[0];
      const name = row[1];
      const unit = row[2];
      const volume = row[4];

      if (!stt || !name) continue;
      const level = (typeof stt === 'string' && stt.match(/\./g))?.length || 0;

      if (name.toUpperCase().includes('HẠNG MỤC')) {
        currentCategory = name;
        continue;
      } else if (level === 1) {
        currentGroup = name;
        continue;
      } else if (level >= 2 && volume) {
        await sql`
          INSERT INTO project_tasks (stt, task_name, unit, contract_volume, parent_id, is_group)
          VALUES (${stt}, ${name}, ${unit}, ${Number(volume)}, null, false);
        `;
      }
    }

    res.status(200).json({ message: 'Tải và lưu hợp đồng thành công' });
  });
}
