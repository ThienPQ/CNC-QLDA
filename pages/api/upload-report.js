// pages/api/upload-report.js
import { formidable } from 'formidable';
import { sql } from '@vercel/postgres';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ hỗ trợ POST' });
  }

  const form = formidable();

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Lỗi xử lý form' });

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file?.filepath) {
      return res.status(400).json({ error: 'Thiếu file báo cáo' });
    }

    const fromDate = fields.fromDate?.[0];
    const toDate = fields.toDate?.[0];

    try {
      const xlsx = await import('xlsx');
      const workbook = xlsx.readFile(file.filepath);

      const sheets = workbook.SheetNames.filter(name =>
        name.toLowerCase().includes('bc tuần')
      );
      if (sheets.length === 0) {
        return res.status(400).json({ error: 'Không có sheet tên "BC tuần..."' });
      }
      sheets.sort((a, b) => b.localeCompare(a, 'vi'));
      const sheet = workbook.Sheets[sheets[0]];

      const raw = xlsx.utils.sheet_to_json(sheet, { header: 1 });

      const data = [];
      for (let i = 33; i < raw.length; i++) {
        const row = raw[i];
        const stt = row[0];
        const task_name = row[1];
        const unit = row[3];
        const volume_now = row[6];
        const volume_total = row[7];
        const percent = row[8];
        const note = row[10];

        if (!stt || !task_name) continue;

        data.push({ stt, task_name, unit, volume_now, volume_total, percent, note });
      }

      for (const item of data) {
        await sql`
          INSERT INTO weekly_reports 
          (stt, task_name, unit, volume_now, volume_total, percent, note, from_date, to_date, start_date, end_date)
          VALUES (
            ${item.stt}, ${item.task_name}, ${item.unit},
            ${item.volume_now}, ${item.volume_total},
            ${item.percent}, ${item.note},
            ${fromDate}, ${toDate}, ${fromDate}, ${toDate}
          );
        `;
      }

      res.status(200).json({ message: 'Lưu báo cáo tuần thành công', sheet: sheets[0] });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Lỗi khi xử lý file Excel' });
    }
  });
}
