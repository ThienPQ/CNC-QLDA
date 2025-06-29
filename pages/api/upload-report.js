import formidable from 'formidable-serverless';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

export const config = {
  api: {
    bodyParser: false, // BẮT BUỘC khi dùng formidable
  },
};

const PG_CONNECTION_STRING = process.env.DATABASE_URL; // Hoặc thay bằng chuỗi connect của bạn

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ chấp nhận POST' });
  }

  // Parse form data
  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    try {
      if (err) {
        console.log("FORMIDABLE ERROR:", err);
        return res.status(400).json({ error: "Lỗi upload form" });
      }

      // In ra fields và files để kiểm tra
      console.log("FIELDS:", fields);
      console.log("FILES:", files);

      const fromDate = fields.fromDate?.[0];
      const toDate = fields.toDate?.[0];
      const file = files.file?.[0] || files.file;

      if (!fromDate || !toDate || !file) {
        console.log("Thiếu dữ liệu fromDate/toDate/file");
        return res.status(400).json({ error: 'Thiếu dữ liệu fromDate, toDate hoặc file' });
      }

      // Đọc file excel
      const filePath = file.filepath || file.path;
      const workbook = xlsx.readFile(filePath);
      // Tìm sheet tên bắt đầu bằng 'BC tuần'
      const sheetName = workbook.SheetNames.find(n => n.trim().toLowerCase().startsWith('bc tuần'));
      if (!sheetName) {
        console.log("Không tìm thấy sheet báo cáo tuần");
        return res.status(400).json({ error: 'Không tìm thấy sheet báo cáo tuần' });
      }
      const ws = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(ws, { header: 1, raw: false });

      // Debug: In thử vài dòng đầu
      console.log("EXCEL RAW DATA:", jsonData.slice(0, 10));

      // TODO: Viết hàm extract đúng dữ liệu cần lấy từ sheet, ví dụ:
      // - Nhận diện dòng hạng mục (La mã: I, II, III...)
      // - Lấy các cột tên Công việc, Lý trình, Đơn vị, Thiết kế, % tuần, % dự án, Ghi chú...

      // Ví dụ trích xuất đơn giản:
      let result = [];
      let currentGroup = "";
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        // Check số La mã đầu dòng (hạng mục cha)
        if (row[0] && /^[IVXLCDM]+\s*$/.test(row[0])) {
          currentGroup = (row[1] || row[0]).toString().trim();
          continue; // Không push hàng này
        }
        // Nếu là dòng dữ liệu (giả lập: phải có tên công việc)
        if (row[1] && row[1].toString().trim()) {
          result.push({
            group: currentGroup,
            task_name: row[1]?.toString().trim(),
            ly_trinh: row[2]?.toString().trim() || "",
            unit: row[3]?.toString().trim() || "",
            thiet_ke: row[4]?.toString().trim() || "",
            percent_week: row[9]?.toString().trim() || "",
            percent_duan: row[10]?.toString().trim() || "",
            note: row[11]?.toString().trim() || "",
            fromDate,
            toDate,
          });
        }
      }
      console.log("DATA PARSED:", result.slice(0, 5));

      // Kết nối Postgres (Neon)
      const client = new Client({ connectionString: PG_CONNECTION_STRING, ssl: { rejectUnauthorized: false } });
      await client.connect();

      // Kiểm tra báo cáo tuần đã tồn tại chưa
      const check = await client.query(
        'SELECT * FROM weekly_reports WHERE from_date = $1 AND to_date = $2',
        [fromDate, toDate]
      );
      if (check.rows.length) {
        console.log('Báo cáo tuần này đã tồn tại');
        await client.end();
        return res.status(400).json({ error: 'Báo cáo tuần này đã tồn tại!' });
      }

      // Lưu vào weekly_reports
      const { rows } = await client.query(
        'INSERT INTO weekly_reports (from_date, to_date) VALUES ($1, $2) RETURNING id',
        [fromDate, toDate]
      );
      const reportId = rows[0]?.id;

      // Lưu từng task vào report_tasks
      for (const r of result) {
        await client.query(
          'INSERT INTO report_tasks (report_id, group_name, task_name, ly_trinh, unit, thiet_ke, percent_week, percent_duan, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
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
