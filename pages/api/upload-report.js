import formidable from "formidable";
import fs from "fs";
import { Client } from "pg"; // hoặc đổi sang mysql2 nếu dùng MySQL
import * as XLSX from "xlsx";

// Disable Next.js default bodyParser:
export const config = { api: { bodyParser: false } };

function parseVnNumber(val) {
  if (!val) return 0;
  let s = val.toString().replace(/\./g, '').replace(/,/g, '.');
  let num = Number(s);
  return isNaN(num) ? 0 : num;
}

function isRomanNumeral(str) {
  return /^(I|II|III|IV|V|VI|VII|VIII|IX|X)$/.test(str);
}
function isSubCode(str) {
  return /^[IVX]+\.\d+$/.test(str);
}
function isStt(str) {
  return /^\d+$/.test(str);
}

function findSheetByName(wb) {
  const sheetNames = wb.SheetNames;
  const found = sheetNames.find(name => name.toLowerCase().startsWith("bc tuan"));
  return found || sheetNames[0];
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Upload lỗi", details: err.toString() });

    try {
      // Lấy file và ngày tuần
      const file = files.file;
      const fromDate = fields.fromDate;
      const toDate = fields.toDate;
      if (!file || !fromDate || !toDate) {
        return res.status(400).json({ error: "Thiếu file hoặc ngày báo cáo" });
      }

      // Đọc Excel
      const workbook = XLSX.read(fs.readFileSync(file.filepath), { type: "buffer" });
      const sheetName = findSheetByName(workbook);
      const ws = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

      // Tìm header
      let headerIdx = rows.findIndex(row =>
        Array.isArray(row) &&
        row.some(cell => (cell + "").toLowerCase().includes("công việc"))
      );
      if (headerIdx < 0) return res.status(400).json({ error: "Không tìm thấy dòng tiêu đề" });

      // Map cột
      const headers = rows[headerIdx].map(h => (h + "").trim().toLowerCase());
      const getColIdx = (name) => headers.findIndex(h => h.includes(name));

      const idxs = {
        task_name: getColIdx("công việc"),
        ly_trinh: getColIdx("lý trình"),
        unit: getColIdx("đơn vị"),
        thiet_ke: getColIdx("thiết kế"),
        percent_week: getColIdx("trong tuần"),
        percent_project: getColIdx("theo dự án"),
        note: getColIdx("ghi chú"),
      };

      // Parse từng dòng
      let groupCode = "", groupName = "", subCode = "", subName = "";
      let data = [];
      for (let i = headerIdx + 1; i < rows.length; ++i) {
        let row = rows[i];
        if (!row || row.length < 3) continue;
        let cell0 = (row[0] || "").toString().trim();

        if (isRomanNumeral(cell0)) {
          groupCode = cell0;
          groupName = (row[1] || "").toString().trim();
          subCode = ""; subName = "";
          continue;
        }
        if (isSubCode(cell0)) {
          subCode = cell0;
          subName = (row[1] || "").toString().trim();
          continue;
        }
        if (isStt(cell0)) {
          // Công việc cụ thể
          data.push({
            from_date: fromDate,
            to_date: toDate,
            group_code: groupCode,
            group_name: groupName,
            sub_code: subCode,
            sub_name: subName,
            stt: cell0,
            task_name: row[idxs.task_name] || "",
            ly_trinh: row[idxs.ly_trinh] || "",
            unit: row[idxs.unit] || "",
            thiet_ke: parseVnNumber(row[idxs.thiet_ke] || ""),
            percent_week: row[idxs.percent_week] || "",
            percent_project: row[idxs.percent_project] || "",
            note: row[idxs.note] || "",
          });
        }
      }

      // Connect DB và insert
      const client = new Client({
        connectionString: process.env.DATABASE_URL, // thay bằng connection string của bạn
      });
      await client.connect();

      // Xóa dữ liệu trùng tuần (nếu muốn), hoặc chỉ insert bổ sung
      await client.query(
        "DELETE FROM weekly_reports WHERE from_date=$1 AND to_date=$2",
        [fromDate, toDate]
      );

      for (let d of data) {
        await client.query(
          `INSERT INTO weekly_reports
          (from_date, to_date, group_code, group_name, sub_code, sub_name, stt, task_name, ly_trinh, unit, thiet_ke, percent_week, percent_project, note)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            d.from_date, d.to_date, d.group_code, d.group_name,
            d.sub_code, d.sub_name, d.stt, d.task_name,
            d.ly_trinh, d.unit, d.thiet_ke,
            d.percent_week, d.percent_project, d.note
          ]
        );
      }

      await client.end();
      return res.json({ success: true, count: data.length });

    } catch (e) {
      return res.status(500).json({ error: "Lỗi xử lý file", details: e.toString() });
    }
  });
}

export default handler;
