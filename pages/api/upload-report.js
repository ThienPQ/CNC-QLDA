// pages/api/upload-report.js
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

    // Gán report_id mới
    const now = new Date();
    const start_date = new Date(now.setDate(now.getDate() - 6));
    const end_date = new Date();

    const reportResult = await sql`
      INSERT INTO weekly_reports (start_date, end_date, file_name)
      VALUES (${start_date}, ${end_date}, ${originalFileName})
      RETURNING id;
    `;
    const report_id = reportResult.rows[0].id;

    // Giả sử sheet có tên chuẩn "BC tuần..."
    const xlsx = await import('xlsx');
    const workbook = xlsx.readFile(savedPath);
    const sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('bc tuần'));
    if (!sheetName) return res.status(400).json({ error: 'Không tìm thấy sheet "BC tuần"' });

    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { range: 33 });

    for (const row of rows) {
      const task_name = row['Mô tả công việc'] || row['Tên công việc'];
      const kh_luong = row['% hoàn thành trong tuần'] || row['Khối lượng'] || 0;
      const ghi_chu = row['Ghi chú'] || '';

      if (!task_name) continue;

      // Tìm task_id theo tên công việc
      const taskResult = await sql`
        SELECT id FROM project_tasks WHERE task_name = ${task_name} LIMIT 1;
      `;
      const task_id = taskResult.rows[0]?.id;
      if (!task_id) continue;

      await sql`
        INSERT INTO progress_entries (task_id, report_id, work_done_this_week, notes)
        VALUES (${task_id}, ${report_id}, ${Number(kh_luong)}, ${ghi_chu});
      `;
    }

    res.status(200).json({ message: 'Tải và lưu báo cáo thành công' });
  });
}