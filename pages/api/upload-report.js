import formidable from "formidable";
import fs from "fs";
import { Client } from "pg"; // Dùng Neon/Postgres. Nếu MySQL thì đổi kết nối.
import * as XLSX from "xlsx";

export const config = { api: { bodyParser: false } };

function parseVnNumber(val) {
  if (!val) return 0;
  // Chuyển "1.234,56" thành 1234.56 (chuẩn VN)
  let s = val.toString().replace(/\./g, '').replace(/,/g, '.');
  let num = Number(s);
  return isNaN(num) ? 0 : num;
}
function isRomanNumeral(str) {
  return /^(I|II|III|IV|V|VI|VII|VIII|IX|X)$/.test(str.trim());
}
function isSubCode(str) {
  return /^[IVX]+\.\d+$/.test(str.trim());
}
function isStt(str) {
  return /^\d+$/.test(str.trim());
}
function cleanKey(str) {
  return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function findSheetByName(wb) {
  const sheetNames = wb.SheetNames;
  // Ưu tiên sheet có "bc" và "tuan" (hoặc dùng sheet đầu)
  const found = sheetNames.find(name => name.toLowerCase().includes("bc") && name.toLowerCase().includes("tuan"));
  return found || sheetNames[0];
}

async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Lỗi upload", details: err.toString() });

    try {
      const file = files.file;
      const fromDate = fields.fromDate;
      const toDate = fields.toDate;
      if (!file || !fromDate || !toDate) {
        return res.status(400).json({ error: "Thiếu file hoặc ngày báo cáo" });
      }

      const workbook = XLSX.read(fs.readFileSync(file.filepath), { type: "buffer" });
      const sheetName = findSheetByName(workbook);
      const ws = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

      // Tìm header tương đối
      let headerIdx = rows.findIndex(row => {
        if (!Array.isArray(row)) return false;
        return row.some(cell =>
          cleanKey(cell).includes("congviec") || cleanKey(cell).includes("tencongviec")
        );
      });
      if (headerIdx < 0) return res.status(400).json({ error: "Không tìm thấy dòng tiêu đề, kiểm tra lại file Excel." });

      // Chuẩn hóa map cột
      const headerRow = rows[headerIdx].map(h => cleanKey(h));
      const colMap = {
        task_name: headerRow.findIndex(h => h.includes("congviec")),
        ly_trinh: headerRow.findIndex(h => h.includes("lytrinh")),
        unit: headerRow.findIndex(h => h.includes("donvi")),
        thiet_ke: headerRow.findIndex(h => h.includes("thietke")),
        percent_week: headerRow.findIndex(h => h.includes("trongtuan")),
        percent_project: headerRow.findIndex(h => h.includes("theoduan")),
        note: headerRow.findIndex(h => h.includes("ghichu"))
      };
      // Báo lỗi nếu thiếu trường bắt buộc
      if (colMap.task_name < 0) return res.status(400).json({ error: "Không tìm thấy cột 'Công việc'!" });

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
          data.push({
            from_date: fromDate,
            to_date: toDate,
            group_code: groupCode,
            group_name: groupName,
            sub_code: subCode,
            sub_name: subName,
            stt: cell0,
            task_name: row[colMap.task_name] || "",
            ly_trinh: row[colMap.ly_trinh] || "",
            unit: row[colMap.unit] || "",
            thiet_ke: parseVnNumber(row[colMap.thiet_ke] || ""),
            percent_week: row[colMap.percent_week] || "",
            percent_project: row[colMap.percent_project] || "",
            note: row[colMap.note] || "",
          });
        }
      }

      if (!data.length) return res.status(400).json({ error: "Không tìm thấy dữ liệu công việc trong file!" });

      // Kết nối DB (sửa connectionString cho đúng của bạn!)
      const client = new Client({
        connectionString: process.env.DATABASE_URL,
      });
      await client.connect();

      // Xóa tuần cũ (tuỳ chọn)
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
