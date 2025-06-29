// pages/api/upload-report.js
import formidable from 'formidable-serverless';
import { Client } from 'pg';
import xlsx from 'xlsx';

export const config = { api: { bodyParser: false } };

const PG_CONNECTION_STRING = process.env.DATABASE_URL;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ chấp nhận POST' });
  }

  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    try {
      if (err) {
        console.log("FORMIDABLE ERROR:", err);
        return res.status(400).json({ error: "Lỗi upload form" });
      }

      // Chuẩn hóa lấy giá trị trường ngày
      const getField = v => (Array.isArray(v) ? v[0] : v);

      const fromDate = getField(fields.fromDate);
      const toDate = getField(fields.toDate);
      const file = files.file?.[0] || files.file;

      // Kiểm tra định dạng ngày yyyy-mm-dd
      const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
      if (!isDate(fromDate) || !isDate(toDate)) {
        return res.status(400).json({ error: 'fromDate/toDate phải là yyyy-mm-dd' });
      }
      if (!file) {
        return res.status(400).json({ error: 'Thiếu file báo cáo tuần' });
      }

      // Đọc file excel
      const filePath = file.filepath || file.path;
      const workbook = xlsx.readFile(filePath);

      // Tìm sheet bắt đầu bằng 'BC tuần'
      const sheetName = workbook.SheetNames.find(n => n.trim().toLowerCase().startsWith('bc tuần'));
      if (!sheetName) {
        return res.status(400).json({ error: 'Không tìm thấy sheet báo cáo tuần' });
      }
      const ws = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: false });

      // --- Bước 1: Tìm dòng tiêu đề đúng ---
      let headerRowIdx = -1;
      let colMap = {};
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i].map(cell => (cell ? cell.toString().toLowerCase().replace(/\s+/g, '') : ''));
        if (
          row.includes('côngviệc') &&
          row.includes('lýtrình') &&
          row.includes('đơnvị') &&
          row.includes('thiếtkế') &&
          row.find(cell => cell.includes('hoànthànhtrongtuần')) !== undefined &&
          row.find(cell => cell.includes('hoànthiệntheodựán')) !== undefined
        ) {
          headerRowIdx = i;
          // Lưu lại index các cột
          const originalRow = rows[i];
          colMap = {
            stt: originalRow.findIndex(cell => cell && cell.toString().toLowerCase().replace(/\s+/g, '') === 'stt'),
            task_name: originalRow.findIndex(cell => cell && cell.toString().toLowerCase().replace(/\s+/g, '') === 'côngviệc'),
            ly_trinh: originalRow.findIndex(cell => cell && cell.toString().toLowerCase().replace(/\s+/g, '') === 'lýtrình'),
            unit: originalRow.findIndex(cell => cell && cell.toString().toLowerCase().replace(/\s+/g, '') === 'đơnvị'),
            thiet_ke: originalRow.findIndex(cell => cell && cell.toString().toLowerCase().replace(/\s+/g, '') === 'thiếtkế'),
            percent_week: originalRow.findIndex(cell => cell && cell.toString().toLowerCase().replace(/\s+/g, '').includes('hoànthànhtrongtuần')),
            percent_duan: originalRow.findIndex(cell => cell && cell.toString().toLowerCase().replace(/\s+/g, '').includes('hoànthiệntheodựán')),
            note: originalRow.findIndex(cell => cell && cell.toString().toLowerCase().replace(/\s+/g, '').includes('ghichú')),
          };
          break;
        }
      }

      if (headerRowIdx === -1) {
        return res.status(400).json({ error: 'Không tìm thấy dòng tiêu đề bảng công việc!' });
      }

      // --- Bước 2: Lấy dữ liệu từng dòng dưới tiêu đề ---
      let data = [];
      let currentGroup = '';
      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every(cell => !cell || cell === '')) break;

        // Nếu dòng bắt đầu bằng số La Mã (I, II, III...) => cập nhật currentGroup
        const sttCell = row[colMap.stt];
        if (typeof sttCell === 'string' && /^[IVXLCDM]+\b/.test(sttCell.trim())) {
          currentGroup = row[colMap.task_name] || '';
          continue;
        }

        // Nếu là dòng công việc thật sự (task_name không rỗng)
        if (row[colMap.task_name] && row[colMap.task_name].toString().trim()) {
          data.push({
            group: currentGroup,
            task_name: row[colMap.task_name] || '',
            ly_trinh: row[colMap.ly_trinh] || '',
            unit: row[colMap.unit] || '',
            thiet_ke: row[colMap.thiet_ke] || '',
            percent_week: row[colMap.percent_week] || '',
            percent_duan: row[colMap.percent_duan] || '',
            note: row[colMap.note] || ''
          });
        }
      }

      // Kết nối và lưu vào CSDL Neon
      const client = new Client({ connectionString: PG_CONNECTION_STRING, ssl: { rejectUnauthorized: false } });
      await client.connect();

      // Kiểm tra báo cáo tuần đã tồn tại chưa
      const check = await client.query(
        'SELECT * FROM weekly_reports WHERE from_date = $1 AND to_date = $2',
        [fromDate, toDate]
      );
      if (check.rows.length) {
        await client.end();
        return res.status(400).json({ error: 'Báo cáo tuần này đã tồn tại!' });
      }

      // Lưu vào weekly_reports
      const { rows: repRows } = await client.query(
        'INSERT INTO weekly_reports (from_date, to_date) VALUES ($1, $2) RETURNING id',
        [fromDate, toDate]
      );
      const reportId = repRows[0]?.id;

      // Lưu từng task vào report_tasks
      for (const r of data) {
        await client.query(
          `INSERT INTO report_tasks 
          (report_id, group_name, task_name, ly_trinh, unit, thiet_ke, percent_week, percent_duan, note) 
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [reportId, r.group, r.task_name, r.ly_trinh, r.unit, r.thiet_ke, r.percent_week, r.percent_duan, r.note]
        );
      }

      await client.end();
      return res.status(200).json({ success: true, message: 'Tải lên thành công!' });

    } catch (err) {
      console.log("UPLOAD MAIN ERROR:", err);
      return res.status(400).json({ error: err.message || "Lỗi upload không xác định" });
    }
  });
}
