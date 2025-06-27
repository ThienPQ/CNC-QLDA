// pages/api/upload-report.js
import formidable from 'formidable';
import { sql } from '@vercel/postgres';
import xlsx from 'xlsx';

export const config = {
  api: {
    bodyParser: false,
  },
};

function normalizeStt(stt) {
  if (!stt) return '';
  if (/^[IVXLCDM]+$/i.test(stt)) {
    const romanToDecimal = {
      I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6', VII: '7',
      VIII: '8', IX: '9', X: '10'
    };
    return romanToDecimal[stt.toUpperCase()] || stt;
  }
  return stt.replace(/[^0-9.]/g, '');
}

export default async function handler(req, res) {
  const form = formidable({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Lỗi xử lý form:', err);
      return res.status(500).json({ message: 'Lỗi xử lý tệp' });
    }

    console.log('Fields:', fields);
    console.log('Files:', files);

    const file = files.file;
    const startDate = fields.startDate;
    const endDate = fields.endDate;

    if (!file || !startDate || !endDate) {
      return res.status(400).json({ message: 'Thiếu dữ liệu đầu vào (file, startDate, endDate)' });
    }

    const uploadedFile = Array.isArray(file) ? file[0] : file;
    if (!uploadedFile || !uploadedFile.filepath) {
      return res.status(400).json({ message: 'Tệp tin không hợp lệ hoặc thiếu đường dẫn' });
    }

    let workbook;
    try {
      workbook = xlsx.readFile(uploadedFile.filepath);
    } catch (e) {
      console.error('Lỗi đọc file Excel:', e);
      return res.status(400).json({ message: 'Không thể đọc nội dung file Excel' });
    }

    const sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('bc tuần'));
    if (!sheetName) {
      return res.status(400).json({ message: 'Không tìm thấy sheet "BC tuần" trong file Excel' });
    }

    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet, { range: 33 });

    const rows = rawData.map(row => ({
      stt: normalizeStt(row['STT']),
      task_name: row['Tên công việc'],
      unit: row['Đơn vị'],
      volume_total: row['Lũy kế đến nay'],
      percent: row['% hoàn thiện theo dự án'],
      note: row['Ghi chú'] || '',
      start_date: Array.isArray(startDate) ? startDate[0] : startDate,
      end_date: Array.isArray(endDate) ? endDate[0] : endDate,
      created_at: new Date().toISOString(),
    }));

    try {
      for (const row of rows) {
        await sql`
          INSERT INTO weekly_reports (stt, task_name, unit, volume_total, percent, note, start_date, end_date, created_at)
          VALUES (${row.stt}, ${row.task_name}, ${row.unit}, ${row.volume_total}, ${row.percent}, ${row.note}, ${row.start_date}, ${row.end_date}, ${row.created_at})
          ON CONFLICT (start_date, end_date, stt) DO UPDATE
          SET task_name = EXCLUDED.task_name,
              unit = EXCLUDED.unit,
              volume_total = EXCLUDED.volume_total,
              percent = EXCLUDED.percent,
              note = EXCLUDED.note,
              created_at = EXCLUDED.created_at;
        `;
      }
      return res.status(200).json({ message: 'Đã lưu báo cáo tuần' });
    } catch (e) {
      console.error('Lỗi khi ghi CSDL:', e);
      return res.status(500).json({ message: 'Lỗi ghi cơ sở dữ liệu' });
    }
  });
}
