// pages/api/upload-report.js
import formidable from 'formidable-serverless';
import * as XLSX from 'xlsx';
import { Pool } from 'pg';

export const config = {
  api: {
    bodyParser: false,
  },
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Khai báo đúng connection string của Neon
  ssl: { rejectUnauthorized: false }
});

// Hàm kiểm tra chuỗi là số La Mã (I, II, III...)
function isRoman(str) {
  return /^[IVXLCDM]+$/.test(str.trim());
}

// Hàm kiểm tra chuỗi là mã mục con (I.1, II.2...)
function isRomanDotNumber(str) {
  return /^[IVXLCDM]+\.\d+$/.test(str.trim());
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err || !files.file) {
      res.status(400).json({ error: 'No file uploaded.' });
      return;
    }

    try {
      // Đọc file excel
      const workbook = XLSX.readFile(files.file.path);
      const sheetNames = workbook.SheetNames.filter(
        name => name.toLowerCase().startsWith('bc tuần')
      );

      if (sheetNames.length === 0) {
        res.status(400).json({ error: 'Không tìm thấy sheet BC tuần...' });
        return;
      }

      // Lấy fromDate và toDate từ fields nếu có, hoặc từ tên sheet
      let fromDate = fields.fromDate || '';
      let toDate = fields.toDate || '';
      // Nếu không có fields, thử lấy từ tên sheet
      if ((!fromDate || !toDate) && sheetNames[0]) {
        const match = sheetNames[0].match(/(\d{1,2})[^\d]+(\d{1,2})[^\d]+(\d{1,4})/g);
        // Tùy cấu trúc tên sheet, có thể bóc tách ngày ở đây nếu bạn muốn
      }

      // Lặp từng sheet báo cáo tuần (mỗi tuần 1 sheet)
      for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        let startRow = 0;
        // Tìm dòng tiêu đề
        for (let i = 0; i < rows.length; i++) {
          const joined = rows[i].join(' ').toLowerCase();
          if (joined.includes('công việc') && joined.includes('đơn vị') && joined.includes('thiết kế')) {
            startRow = i + 1;
            break;
          }
        }
        if (!startRow) continue; // Không tìm thấy tiêu đề

        let group_code = '';
        let group_name = '';
        let skip = false;

        for (let i = startRow; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 2) continue;

          // Bỏ qua mọi dòng chứa từ khóa "kết luận" hoặc "kiến nghị" (từ khóa không phân biệt hoa thường)
          const joinedRow = row.map(cell => String(cell || '').toLowerCase()).join(' ');
          if (joinedRow.includes('kết luận') || joinedRow.includes('kiến nghị')) break;

          // Nếu là hạng mục cha (I, II, III...), lấy tên nhóm cha
          if (isRoman(row[0])) {
            group_code = row[0].trim();
            // Lấy tên nhóm cha từ cột tiếp theo có text
            group_name = '';
            for (let c = 1; c < row.length; c++) {
              if (row[c] && row[c].trim()) {
                group_name = row[c].trim();
                break;
              }
            }
            continue;
          }

          // Nếu là hạng mục con (I.1, I.2...), gán sub_code & sub_name
          let sub_code = '';
          let sub_name = '';
          if (isRomanDotNumber(row[0])) {
            sub_code = row[0].trim();
            sub_name = '';
            for (let c = 1; c < row.length; c++) {
              if (row[c] && row[c].trim()) {
                sub_name = row[c].trim();
                break;
              }
            }
            // Không push dòng này, vì là header nhóm con
            continue;
          }

          // Chỉ parse các dòng dữ liệu thực sự (có tên công việc)
          // Giả sử tiêu đề là: STT | Công việc | Lý trình | Đơn vị | Thiết kế | ...% trong tuần | ...% theo dự án | Ghi chú
          // Bạn có thể cần điều chỉnh chỉ số dưới đây đúng với file thực tế!
          if (
            row.length >= 10 &&                // Số cột tối thiểu
            row[1] && row[3] && row[4]         // Có Tên công việc, Đơn vị, Thiết kế
          ) {
            // Đưa dữ liệu vào database
            await pool.query(
              `INSERT INTO weekly_reports 
                (group_code, group_name, sub_code, sub_name, task_name, ly_trinh, unit, thiet_ke, percent_week, percent_duan, note, from_date, to_date)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
              [
                group_code,
                group_name,
                sub_code,
                sub_name,
                row[1].trim(),
                row[2] ? row[2].trim() : '',
                row[3].trim(),
                row[4] ? row[4].trim() : '',
                row[8] ? row[8].toString().replace('%', '').trim() : '', // % trong tuần
                row[9] ? row[9].toString().replace('%', '').trim() : '', // % theo dự án
                row[10] ? row[10].trim() : '',
                fromDate,
                toDate,
              ]
            );
          }
        }
      }

      res.status(200).json({ message: 'Đã upload và lưu báo cáo tuần!' });
    } catch (e) {
      res.status(500).json({ error: e.message || e.toString() });
    }
  });
}
