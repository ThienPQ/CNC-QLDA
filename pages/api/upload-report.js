// pages/api/upload-report.js
import formidable from 'formidable-serverless';
import xlsx from 'xlsx';
import { Pool } from 'pg';

export const config = { api: { bodyParser: false } };
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function isRoman(str) { return /^[IVXLCDM]+(\.)?$/.test((str||"").toString().trim()); }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Only POST allowed");
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    const client = await pool.connect();
    try {
      const from_date = fields.from_date?.toString();
      const to_date = fields.to_date?.toString();
      if (!from_date || !to_date) return res.status(400).json({ error: "Thiếu ngày báo cáo." });

      // Kiểm tra trùng tuần
      const { rows: exist } = await client.query(
        "SELECT * FROM weekly_reports WHERE from_date=$1 AND to_date=$2", [from_date, to_date]
      );
      if (exist.length > 0) return res.status(400).json({ error: "Tuần này đã có báo cáo!" });

      // Tạo báo cáo tuần mới
      const { rows: rep } = await client.query(
        "INSERT INTO weekly_reports (from_date, to_date) VALUES ($1,$2) RETURNING id",
        [from_date, to_date]
      );
      const report_id = rep[0].id;

      // Đọc file excel
      const workbook = xlsx.readFile(files.file.filepath);
      const sheetNames = workbook.SheetNames.filter(name => name.toLowerCase().startsWith('bc tuần'));
      for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        let parent_code = "", parent_name = "";
        let group_code = "", group_name = "";
        let headerRowIdx = data.findIndex(row =>
          row && row.some(cell => (cell||"").toLowerCase().includes('công việc'))
        );
        if (headerRowIdx === -1) continue;
        const header = data[headerRowIdx];

        // Xác định cột
        const colMap = {};
        header.forEach((cell, idx) => {
          if ((cell||"").toLowerCase().includes("công việc")) colMap.task_name = idx;
          if ((cell||"").toLowerCase().includes("lý trình")) colMap.ly_trinh = idx;
          if ((cell||"").toLowerCase().includes("đơn vị")) colMap.unit = idx;
          if ((cell||"").toLowerCase().includes("thiết kế")) colMap.volume = idx;
          if ((cell||"").toLowerCase().includes("% hoàn thành trong tuần")) colMap.percent_week = idx;
          if ((cell||"").toLowerCase().includes("% hoàn thiện theo dự án")) colMap.percent_project = idx;
          if ((cell||"").toLowerCase().includes("ghi chú")) colMap.note = idx;
        });

        // Parse từng dòng sau header
        for (let i = headerRowIdx + 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;
          // Hạng mục cha
          if (isRoman(row[0]) && !/\./.test(row[0])) {
            parent_code = row[0];
            parent_name = row.find((c, idx) => idx > 0 && c && c.toString().trim() !== "") || "";
            continue;
          }
          // Nhóm con (I.1, I.2...)
          if (/^[IVXLCDM]+\.\d+$/.test(row[0])) {
            group_code = row[0];
            group_name = row.find((c, idx) => idx > 0 && c && c.toString().trim() !== "") || "";
            continue;
          }
          // Dòng công việc
          const task_name = row[colMap.task_name] || "";
          if (!task_name || !parent_code || !group_code) continue;

          await client.query(
            `INSERT INTO report_tasks (
              report_id, parent_code, parent_name, group_code, group_name, task_name,
              unit, volume, percent_week, percent_project, note
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              report_id, parent_code, parent_name, group_code, group_name, task_name,
              row[colMap.unit]||"", parseFloat(row[colMap.volume]||0), row[colMap.percent_week]||"",
              row[colMap.percent_project]||"", row[colMap.note]||""
            ]
          );
        }
      }
      client.release();
      res.status(200).json({ message: "Upload và import thành công!" });
    } catch (error) {
      client.release();
      res.status(500).json({ error: error.message });
    }
  });
}
