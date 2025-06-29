// pages/api/upload-report.js
import formidable from "formidable-serverless";
import xlsx from "xlsx";
import { Pool } from "pg";

export const config = {
  api: { bodyParser: false }
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Regex nhận diện số La Mã (I, II...), La Mã.k (I.1, I.2...)
const isRoman = (text) => /^[IVXLCDM]+\s*$/.test((text || "").toString().trim());
const isRomanDotNumber = (text) => /^[IVXLCDM]+\.\d+/.test((text || "").toString().trim());

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Upload error", detail: err });

    try {
      const file = files.file;
      const workbook = xlsx.readFile(file.path);
      // Tìm sheet đúng dạng "BC tuần ..."
      const sheetName = workbook.SheetNames.find((name) => name.toLowerCase().startsWith("bc tuần"));
      if (!sheetName) return res.status(400).json({ error: "Không tìm thấy sheet BC tuần..." });

      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      // Xác định dòng tiêu đề chuẩn
      const requiredCols = [
        "công việc", "lý trình", "đơn vị", "thiết kế",
        "% hoàn thành trong tuần", "% hoàn thiện theo dự án", "ghi chú"
      ];
      let headerRowIdx = data.findIndex(row =>
        row && requiredCols.every(col =>
          row.some(cell => (cell || "").toString().toLowerCase().includes(col))
        )
      );
      if (headerRowIdx === -1) return res.status(400).json({ error: "Không tìm thấy dòng tiêu đề chuẩn" });
      const headerRow = data[headerRowIdx];

      // Lấy vị trí cột
      const colIdx = {};
      for (let col of requiredCols) {
        colIdx[col] = headerRow.findIndex(cell => (cell || "").toString().toLowerCase().includes(col));
      }
      colIdx["task_name"] = headerRow.findIndex(cell => (cell || "").toString().toLowerCase().includes("công việc"));
      colIdx["stt"] = headerRow.findIndex(cell => (cell || "").toString().toLowerCase().includes("stt"));

      // Ngày báo cáo
      const fromDate = fields.from_date && fields.from_date[0] ? fields.from_date[0] : (fields.from_date || "");
      const toDate = fields.to_date && fields.to_date[0] ? fields.to_date[0] : (fields.to_date || "");

      // Kiểm tra trường ngày bắt buộc
      if (!fromDate || !toDate) return res.status(400).json({ error: "Thiếu ngày bắt đầu/kết thúc báo cáo tuần!" });

      // Bắt đầu đọc từng dòng dữ liệu
      let group_code = "", group_name = "", sub_code = "", sub_name = "";
      for (let i = headerRowIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 4) continue;

        // Dừng lại nếu gặp "Kết luận", "Kiến nghị"
        const joined = row.join(" ").toLowerCase();
        if (joined.includes("kết luận") || joined.includes("kiến nghị")) break;

        // Hạng mục cha (I, II, III...)
        if (isRoman(row[colIdx["stt"]])) {
          group_code = (row[colIdx["stt"]] || "").trim();
          group_name = (row[colIdx["task_name"]] || "").trim();
          sub_code = ""; sub_name = "";
          continue;
        }

        // Hạng mục con (I.1, I.2...)
        if (isRomanDotNumber(row[colIdx["stt"]])) {
          sub_code = (row[colIdx["stt"]] || "").trim();
          sub_name = (row[colIdx["task_name"]] || "").trim();
          continue;
        }

        // Dòng dữ liệu công việc
        const taskName = (row[colIdx["task_name"]] || "").trim();
        if (taskName) {
          // Lấy giá trị % sạch ký tự %
          const percent_week = ((row[colIdx["% hoàn thành trong tuần"]] || "").toString().replace("%", "").trim());
          const percent_duan = ((row[colIdx["% hoàn thiện theo dự án"]] || "").toString().replace("%", "").trim());

          await pool.query(
            `INSERT INTO weekly_reports 
              (group_code, group_name, sub_code, sub_name, task_name, ly_trinh, unit, thiet_ke, percent_week, percent_duan, note, from_date, to_date)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
              group_code, group_name, sub_code, sub_name, taskName,
              (row[colIdx["lý trình"]] || "").toString().trim(),
              (row[colIdx["đơn vị"]] || "").toString().trim(),
              (row[colIdx["thiết kế"]] || "").toString().trim(),
              percent_week,
              percent_duan,
              (row[colIdx["ghi chú"]] || "").toString().trim(),
              fromDate,
              toDate
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
