// THAY THẾ HOÀN TOÀN file upload-report.js hiện tại bằng đoạn dưới

import formidable from 'formidable';
import fs from 'fs';
import { sql } from '@vercel/postgres';
import xlsx from 'xlsx';

export const config = {
  api: {
    bodyParser: false,
  },
};

function normalizeStt(stt) {
  if (!stt) return '';
  if (/^[IVXLCDM]+$/i.test(stt)) return stt.toUpperCase(); // Hạng mục
  return stt.replace(/[^0-9.]/g, '');
}

export default async function handler(req, res) {
  const form = formidable({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ message: 'Lỗi xử lý tệp' });

    const file = files.file;
    const startDate = fields.startDate?.[0];
    const endDate = fields.endDate?.[0];
    if (!file || !startDate || !endDate) {
      return res.status(400).json({ message: 'Thiếu dữ liệu đầu vào' });
    }

    const workbook = xlsx.readFile(file[0].filepath);
    const sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('bc tuần'));
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet, { range: 33 });

    let currentHạngMục = '';
    let currentNhóm = '';

    const rows = [];

    for (const row of rawData) {
      const sttRaw = normalizeStt(row['STT']);
      if (!sttRaw) continue;

      if (/^[IVXLCDM]+$/.test(sttRaw)) {
        currentHạngMục = row['Tên công việc']?.trim() || 'Không rõ';
        continue;
      } else if (/^\d+$/.test(sttRaw)) {
        currentNhóm = row['Tên công việc']?.trim() || 'Nhóm không rõ';
        continue;
      }

      rows.push({
        stt: sttRaw,
        task_name: row['Tên công việc'],
        unit: row['Đơn vị'],
        volume_total: row['Lũy kế đến nay'],
        percent: row['% hoàn thiện theo dự án'],
        note: row['Ghi chú'] || '',
        hang_muc: currentHạngMục,
        nhom_cong_viec: currentNhóm,
        start_date: startDate,
        end_date: endDate,
        created_at: new Date().toISOString(),
      });
    }

    try {
      for (const row of rows) {
        await sql`
          INSERT INTO weekly_reports (stt, task_name, unit, volume_total, percent, note, start_date, end_date, created_at, hang_muc, nhom_cong_viec)
          VALUES (${row.stt}, ${row.task_name}, ${row.unit}, ${row.volume_total}, ${row.percent}, ${row.note}, ${row.start_date}, ${row.end_date}, ${row.created_at}, ${row.hang_muc}, ${row.nhom_cong_viec})
          ON CONFLICT (start_date, end_date, stt) DO UPDATE
          SET task_name = EXCLUDED.task_name,
              unit = EXCLUDED.unit,
              volume_total = EXCLUDED.volume_total,
              percent = EXCLUDED.percent,
              note = EXCLUDED.note,
              hang_muc = EXCLUDED.hang_muc,
              nhom_cong_viec = EXCLUDED.nhom_cong_viec,
              created_at = EXCLUDED.created_at;
        `;
      }

      return res.status(200).json({ message: 'Đã lưu báo cáo tuần' });
    } catch (e) {
      console.error('Lỗi ghi CSDL:', e);
      return res.status(500).json({ message: 'Lỗi ghi cơ sở dữ liệu' });
    }
  });
}
