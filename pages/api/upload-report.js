import formidable from "formidable-serverless";
import xlsx from "xlsx";
import { Pool } from "pg";

export const config = {
  api: {
    bodyParser: false,
  },
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const isRoman = (text) => /^[IVXLCDM]+\s*$/.test(text?.toString().trim());
const isRomanDotNumber = (text) => /^[IVXLCDM]+\.\d+/.test(text?.toString().trim());

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Upload error", detail: err });

    try {
      const file = files.file;
      const workbook = xlsx.readFile(file.path);
      const sheetName = workbook.SheetNames.find((name) => name.toLowerCase().startsWith("bc tuần"));
      if (!sheetName) return res.status(400).json({ error: "Không tìm thấy sheet BC tuần..." });

      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      // Tìm dòng tiêu đề - dòng đầu tiên chứa đủ các trường bắt buộc
      const requiredCols = [
        "công việc", "lý trình", "đơn vị", "thiết kế",
        "% hoàn thành trong tuần", "% hoàn thiện theo dự án", "ghi chú"
      ];
      let headerRowIdx = data.findIndex(row =>
        row && requiredCols.every(col =>
          row.some(cell => cell?.toString().toLowerCase().includes(col))
        )
      );
      if (headerRowIdx === -1) return res.status(400).json({ error: "Không tìm thấy dòng tiêu đề chuẩn" });

      const headerRow = data[headerRowIdx];
      // Xác định vị trí từng cột theo tên tiêu đề
      const colIdx = {};
      for (let col of requiredCols) {
        colIdx[col] = headerRow.findIndex(cell => cell?.toString().toLowerCase().includes(col));
      }
      colIdx["task_name"] = headerRow.findIndex(cell => cell?.toString().toLowerCase().includes("công việc"));
      colIdx["stt"] = headerRow.findIndex(cell => cell?.toString().toLowerCase().includes("stt"));

      // Nhận ngày từ trường fields hoặc tên sheet (nếu không có, mặc định rỗng)
      const fromDate = fields.from_date || "";
      const toDate = fields.to_date || "";

      // Duyệt từng dòng dữ liệu, bỏ qua dòng tiêu đề, kết luận, kiến nghị
      let group_code = "", group_name = "", sub_code = "", sub_name = "";
      for (let i = headerRowIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 4) continue;

        // Bỏ qua dòng trống, dòng kết luận, kiến nghị
        const joined = row.join(" ").toLowerCase();
        if (joined.includes("kết luận") || joined.includes("kiến nghị")) break;

        // Hạng mục cha
        if (isRoman(row[colIdx["stt"]])) {
          group_code = row[colIdx["stt"]].trim();
          group_name = row[colIdx["task_name"]]?.trim() || "";
          sub_code = "";
          sub_name = "";
          continue;
        }

        // Hạng mục con (I.1, I.2...)
        if (isRomanDotNumber(row[colIdx["stt"]])) {
          sub_code = row[colIdx["stt"]].trim();
          sub_name = row[colIdx["task_name"]]?.trim() || "";
          continue;
        }

        // Nếu là dòng dữ liệu (có tên công việc)
        const taskName = row[colIdx["task_name"]]?.trim();
        if (taskName) {
          // Ghi vào DB
          await pool.query(
            `INSERT INTO weekly_reports 
              (group_code, group_name, sub_code, sub_name, task_name, ly_trinh, unit, thiet_ke, percent_week, percent_duan, note, from_date, to_date)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
              group_code, group_name, sub_code, sub_name, taskName,
              row[colIdx["lý trình"]]?.toString().trim() || "",
              row[colIdx["đơn vị"]]?.toString().trim() || "",
              row[colIdx["thiết kế"]]?.toString().trim() || "",
              row[colIdx["% hoàn thành trong tuần"]]?.toString().replace("%", "").trim() || "",
              row[colIdx["% hoàn thiện theo dự án"]]?.toString().replace("%", "").trim() || "",
              row[colIdx["ghi chú"]]?.trim() || "",
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
