import formidable from "formidable";
import fs from "fs";
import { Client } from "pg";
import XLSX from "xlsx";

export const config = { api: { bodyParser: false } };

// Đọc biến môi trường Neon/Vercel DB
const PGHOST = process.env.PGHOST;
const PGDATABASE = process.env.PGDATABASE;
const PGUSER = process.env.PGUSER;
const PGPASSWORD = process.env.PGPASSWORD;
const PGPORT = process.env.PGPORT || 5432;

// Hàm format số Việt Nam, 3 số lẻ, nhận mọi kiểu số
function formatVN(val) {
  if (val === undefined || val === null || val === '') return '';
  let s = String(val).replace(/\s/g, '').replace(/[^0-9.,-]/g, '');
  // Dạng 12.345,67 hoặc 12.345,6789
  if (/^\d{1,3}(\.\d{3})*(\,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  // Dạng 12345,67 hoặc 12345,6789
  else if (/^\d+(,\d+)?$/.test(s)) {
    s = s.replace(',', '.');
  }
  // Dạng 12345.67 hoặc 12345.6789: giữ nguyên
  let num = Number(s);
  if (isNaN(num)) return '';
  let [nguyen, le] = num.toFixed(3).split('.');
  return nguyen.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + le;
}

// Lấy sheet "BC tuần..." mới nhất
function getNewestBCTuanSheet(workbook) {
  const bcSheets = workbook.SheetNames.filter(s =>
    s.trim().toLowerCase().startsWith('bc tuần')
  );
  if (!bcSheets.length) throw new Error('Không tìm thấy sheet "BC tuần..."');
  bcSheets.sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
  return bcSheets[bcSheets.length - 1];
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const form = new formidable.IncomingForm({ keepExtensions: true });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "File upload error!" });
    const excelPath = files.file.filepath || files.file.path;
    const workbook = XLSX.readFile(excelPath);
    const sheetName = getNewestBCTuanSheet(workbook);
    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Kết nối DB Neon/Vercel
    const client = new Client({
      host: PGHOST,
      port: PGPORT,
      database: PGDATABASE,
      user: PGUSER,
      password: PGPASSWORD,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    let groupCode = '', groupName = '', subCode = '', subName = '';
    let collecting = false, importCount = 0, errCount = 0;

    for (let row of rows) {
      const firstCol = (row[0] || '').toString().trim();
      if (!collecting && firstCol.toUpperCase().includes('CÔNG VIỆC THỰC HIỆN TRONG TUẦN')) {
        collecting = true;
        continue;
      }
      if (!collecting) continue;
      if (!row[1]) continue;

      if (/^[IVXLCDM]+$/.test(firstCol)) {
        groupCode = firstCol;
        groupName = row[1].toString().trim();
        subCode = subName = '';
        continue;
      }
      if (/^[IVXLCDM]+\.\d+$/.test(firstCol)) {
        subCode = firstCol;
        subName = row[1].toString().trim();
        continue;
      }
      if (/^\d+$/.test(firstCol) && subCode) {
        let taskCode = `${subCode}.${firstCol}`;
        let taskName = row[1] ? row[1].toString().trim() : '';
        let unit = row[3] ? row[3].toString().trim() : '';
        let design_quantity = formatVN(row[4]);
        let luuy_ke_den_nay = formatVN(row[8]);
        let percent_in_week = formatVN(row[9]);
        let percent_in_project = formatVN(row[10]);
        let note = row[16] ? row[16].toString().trim() : '';

        try {
          await client.query(`
            INSERT INTO weekly_reports
              (week_sheet, group_code, group_name, sub_code, sub_name, task_code, task_name, unit,
              design_quantity, luuy_ke_den_nay, percent_in_week, percent_in_project, note)
            VALUES
              ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `, [
            sheetName, groupCode, groupName, subCode, subName, taskCode, taskName, unit,
            design_quantity, luuy_ke_den_nay, percent_in_week, percent_in_project, note
          ]);
          importCount++;
        } catch (e) {
          errCount++;
        }
      }
    }
    await client.end();
    res.json({ ok: true, imported: importCount, errors: errCount, week: sheetName });
  });
}
