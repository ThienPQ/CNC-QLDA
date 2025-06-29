// pages/api/upload-report.js
import formidable from "formidable-serverless";
import * as XLSX from "xlsx";
import { Pool } from "pg";

// Kết nối Neon Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const config = {
  api: { bodyParser: false }
};

function parseDateExcel(input) {
  // Nhận các dạng 15/6/2025 hoặc 2025-06-15
  if (!input) return null;
  if (typeof input === "string") {
    const parts = input.split("/");
    if (parts.length === 3) {
      // dd/mm/yyyy
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(input)) return input;
  }
  if (typeof input === "number") {
    // Ngày excel dạng số
    const d = XLSX.SSF.parse_date_code(input);
    if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Lỗi upload file" });
    if (!files.file) return res.status(400).json({ error: "Không có file" });

    const workbook = XLSX.readFile(files.file.path);
    // Tìm sheet tên bắt đầu BC tuần
    const sheetName = workbook.SheetNames.find(name => name.toLowerCase().startsWith("bc tuần"));
    if (!sheetName) return res.status(400).json({ error: "Không tìm thấy sheet báo cáo tuần" });

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });

    // ==== Tìm dòng tiêu đề ====
    const cols = [
      "công việc", "lý trình", "đơn vị", "thiết kế",
      "% hoàn thành trong tuần", "% hoàn thiện theo dự án", "ghi chú"
    ];
    let headerIdx = data.findIndex(row =>
      Array.isArray(row) &&
      cols.every(c => row.some(cell => String(cell || "").toLowerCase().includes(c)))
    );
    if (headerIdx === -1) return res.status(400).json({ error: "Không tìm thấy dòng tiêu đề chuẩn" });

    const headerRow = data[headerIdx];
    // Xác định chỉ số cột
    const colIdx = {};
    for (let c of cols) {
      colIdx[c] = headerRow.findIndex(cell => String(cell || "").toLowerCase().includes(c));
    }
    colIdx["stt"] = headerRow.findIndex(cell => String(cell || "").toLowerCase().includes("stt"));

    // ==== Dò ngày báo cáo (from, to) ====
    let fromDate = null, toDate = null;
    for (let i = 0; i < headerIdx; ++i) {
      const joined = (data[i] || []).join(" ").toLowerCase();
      // Ví dụ: BÁO CÁO TUẦN 2 THÁNG 06 (tìm các dạng tuần/tháng/năm hoặc ngày...)
      const match = joined.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/);
      if (match) {
        // Ưu tiên chuỗi ngày/tháng/năm
        fromDate = parseDateExcel(match[0]);
        toDate = parseDateExcel(match[0]);
        break;
      }
    }
    // Nếu truyền fields.from_date/to_date thì ưu tiên
    if (fields.from_date) fromDate = parseDateExcel(fields.from_date);
    if (fields.to_date) toDate = parseDateExcel(fields.to_date);

    // ==== Parse dữ liệu ====
    let group = "", group_name = "";
    let toInsert = [];
    for (let i = headerIdx + 1; i < data.length; ++i) {
      const row = data[i];

      // Kiểm tra dòng nhóm cha (số la mã)
      const sttCell = String(row[colIdx["stt"]] || "").trim();
      if (/^(I{1,3}|IV|V|VI|VII|VIII|IX|X)\.?$/.test(sttCell)) {
        group = sttCell.replace(/\./g, "");
        // Lấy tên nhóm là bất kỳ ô nào sau số la mã (ưu tiên col công việc, nếu trống thì lấy cột sau stt)
        group_name = String(row[colIdx["công việc"]] || row[colIdx["stt"]]+ " " + (row[colIdx["công việc"]+1]||"")).trim();
        continue;
      }
      // Bỏ dòng kiến nghị, kết luận
      const taskName = String(row[colIdx["công việc"]] || "").toLowerCase();
      if (!group || /kiến nghị|kết luận/.test(taskName)) continue;

      // Bỏ dòng không có tên công việc
      if (!row[colIdx["công việc"]] || String(row[colIdx["công việc"]]).trim() === "") continue;

      toInsert.push({
        group_code: group,
        group_name,
        sub_code: String(row[colIdx["stt"]] || "").replace(/\./g, ""),
        sub_name: String(row[colIdx["công việc"]] || ""),
        ly_trinh: String(row[colIdx["lý trình"]] || ""),
        unit: String(row[colIdx["đơn vị"]] || ""),
        thiet_ke: String(row[colIdx["thiết kế"]] || ""),
        percent_week: String(row[colIdx["% hoàn thành trong tuần"]] || ""),
        percent_duan: String(row[colIdx["% hoàn thiện theo dự án"]] || ""),
        note: String(row[colIdx["ghi chú"]] || ""),
        from_date: fromDate || null,
        to_date: toDate || null
      });
    }

    if (!toInsert.length) return res.status(400).json({ error: "Không có dữ liệu công việc hợp lệ" });

    // === Ghi vào database ===
    try {
      for (const r of toInsert) {
        await pool.query(
          `INSERT INTO weekly_reports
            (group_code, group_name, sub_code, sub_name, ly_trinh, unit, thiet_ke, percent_week, percent_duan, note, from_date, to_date)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            r.group_code, r.group_name, r.sub_code, r.sub_name,
            r.ly_trinh, r.unit, r.thiet_ke, r.percent_week, r.percent_duan,
            r.note, r.from_date, r.to_date
          ]
        );
      }
      return res.json({ ok: true, inserted: toInsert.length });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });
}
