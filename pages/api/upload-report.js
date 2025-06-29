// pages/api/upload-report.js
import formidable from "formidable-serverless";
import xlsx from "xlsx";
import { Pool } from "pg";

export const config = { api: { bodyParser: false } };
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Regex nhận diện La Mã (I, II...) và La Mã chấm số (I.1, I.2...)
const isRoman = (txt) => /^[IVXLCDM]+\s*$/.test((txt||"").toString().trim());
const isRomanDot = (txt) => /^[IVXLCDM]+\.\d+/.test((txt||"").toString().trim());

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Upload error", detail: err });

    try {
      const file = files.file;
      const workbook = xlsx.readFile(file.path);
      const sheetName = workbook.SheetNames.find((n) => n.toLowerCase().startsWith("bc tuần"));
      if (!sheetName) return res.status(400).json({ error: "Không tìm thấy sheet BC tuần..." });

      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      // Tìm dòng header
      const cols = ["công việc", "lý trình", "đơn vị", "thiết kế", "% hoàn thành trong tuần", "% hoàn thiện theo dự án", "ghi chú"];
      let headerIdx = data.findIndex(row => cols.every(c => row.some(cell => (cell||"").toLowerCase().includes(c))));
      if (headerIdx === -1) return res.status(400).json({ error: "Không tìm thấy dòng tiêu đề chuẩn" });
      const headerRow = data[headerIdx];
      const colIdx = {};
      for (let c of cols) colIdx[c] = headerRow.findIndex(cell => (cell||"").toLowerCase().includes(c));
      colIdx["task_name"] = headerRow.findIndex(cell => (cell||"").toLowerCase().includes("công việc"));
      colIdx["stt"] = headerRow.findIndex(cell => (cell||"").toLowerCase().includes("stt"));

      // Lấy ngày từ fields
      const fromDate = fields.from_date && fields.from_date[0] ? fields.from_date[0] : fields.from_date || "";
      const toDate = fields.to_date && fields.to_date[0] ? fields.to_date[0] : fields.to_date || "";
      if (!fromDate || !toDate) return res.status(400).json({ error: "Thiếu ngày từ/đến" });

      // Xóa các record tuần này trước khi insert mới
      await pool.query(`DELETE FROM weekly_reports WHERE from_date=$1 AND to_date=$2`, [fromDate, toDate]);

      let group_code = "", group_name = "", sub_code = "", sub_name = "";
      for (let i = headerIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 4) continue;
        const join = row.join(" ").toLowerCase();
        if (join.includes("kết luận") || join.includes("kiến nghị")) break;

        if (isRoman(row[colIdx["stt"]])) {
          group_code = (row[colIdx["stt"]] || "").trim();
          group_name = (row[colIdx["task_name"]] || "").trim();
          sub_code = ""; sub_name = "";
          continue;
        }
        if (isRomanDot(row[colIdx["stt"]])) {
          sub_code = (row[colIdx["stt"]] || "").trim();
          sub_name = (row[colIdx["task_name"]] || "").trim();
          continue;
        }
        const taskName = (row[colIdx["task_name"]] || "").trim();
        if (taskName) {
          const percent_week = (row[colIdx["% hoàn thành trong tuần"]] || "").toString().replace("%", "").trim();
          const percent_duan = (row[colIdx["% hoàn thiện theo dự án"]] || "").toString().replace("%", "").trim();
          await pool.query(
            `INSERT INTO weekly_reports 
              (group_code, group_name, sub_code, sub_name, task_name, ly_trinh, unit, thiet_ke, percent_week, percent_duan, note, from_date, to_date)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
              group_code, group_name, sub_code, sub_name, taskName,
              (row[colIdx["lý trình"]]||"").trim(),
              (row[colIdx["đơn vị"]]||"").trim(),
              (row[colIdx["thiết kế"]]||"").trim(),
              percent_week,
              percent_duan,
              (row[colIdx["ghi chú"]]||"").trim(),
              fromDate, toDate
            ]
          );
        }
      }
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error("UPLOAD-REPORT-ERROR:", e);
      return res.status(500).json({ error: "Lỗi xử lý file báo cáo", detail: e.toString() });
    }
  });
}
