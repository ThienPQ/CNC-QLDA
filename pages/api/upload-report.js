// pages/api/upload-report.js
import formidable from 'formidable-serverless';
import xlsx from 'xlsx';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const config = { api: { bodyParser: false } };

function isRomanNumeral(str) {
  return /^[IVXLCDM]+\.*$/.test(str.trim());
}

function findHeaderRow(sheet) {
  const headers = [
    "Công việc", "Lý trình", "Đơn vị", "Thiết kế", 
    "% hoàn thành trong tuần", "% hoàn thiện theo dự án", "Ghi chú"
  ];
  const range = xlsx.utils.decode_range(sheet['!ref']);
  for (let row = range.s.r; row <= range.e.r; ++row) {
    let found = 0;
    let headerIndexes = {};
    for (let col = range.s.c; col <= range.e.c; ++col) {
      const cell = sheet[xlsx.utils.encode_cell({c: col, r: row})];
      if (cell && typeof cell.v === 'string') {
        for (const h of headers) {
          if (cell.v.trim().toLowerCase().includes(h.toLowerCase())) {
            found += 1;
            headerIndexes[h] = col;
          }
        }
      }
    }
    if (found >= headers.length - 1) {
      return { row, headerIndexes };
    }
  }
  return null;
}

async function parseExcel(filePath, fromDate, toDate) {
  const workbook = xlsx.readFile(filePath);
  const results = [];
  for (const sheetName of workbook.SheetNames) {
    if (!/^BC tuần/i.test(sheetName)) continue;
    const sheet = workbook.Sheets[sheetName];
    const headerInfo = findHeaderRow(sheet);
    if (!headerInfo) continue;
    const { row: headerRow, headerIndexes } = headerInfo;
    const range = xlsx.utils.decode_range(sheet['!ref']);
    let currentGroup = '';
    let currentGroupName = '';
    let currentSubGroup = '';
    let currentSubGroupName = '';
    for (let r = headerRow + 1; r <= range.e.r; ++r) {
      const firstCell = sheet[xlsx.utils.encode_cell({c: range.s.c, r})];
      const secondCell = sheet[xlsx.utils.encode_cell({c: range.s.c + 1, r})];
      if (firstCell && typeof firstCell.v === 'string' && isRomanNumeral(firstCell.v.trim())) {
        currentGroup = firstCell.v.trim();
        currentGroupName = secondCell && secondCell.v ? secondCell.v.toString().trim() : '';
        continue;
      }
      if (firstCell && typeof firstCell.v === 'string' && /^[IVXLCDM]+\.[0-9]+$/.test(firstCell.v.trim())) {
        currentSubGroup = firstCell.v.trim();
        currentSubGroupName = secondCell && secondCell.v ? secondCell.v.toString().trim() : '';
      }

      let rowObj = {};
      for (const key in headerIndexes) {
        const colIdx = headerIndexes[key];
        const cell = sheet[xlsx.utils.encode_cell({c: colIdx, r})];
        let val = cell && cell.v ? cell.v : '';
        if (typeof val === 'number') val = val.toString();
        rowObj[key] = val;
      }

      if (rowObj["Công việc"] || currentSubGroup) {
        results.push({
          group_code: currentGroup,
          group_name: currentGroupName,
          sub_group_code: currentSubGroup,
          sub_group_name: currentSubGroupName,
          task_name: rowObj["Công việc"] || '',
          ly_trinh: rowObj["Lý trình"] || '',
          unit: rowObj["Đơn vị"] || '',
          thiet_ke: rowObj["Thiết kế"] || '',
          percent_week: rowObj["% hoàn thành trong tuần"] || '',
          percent_duan: rowObj["% hoàn thiện theo dự án"] || '',
          note: rowObj["Ghi chú"] || '',
          fromDate, toDate
        });
      }
    }
  }
  return results;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(400).json({ error: 'Form parse error' });
      return;
    }
    try {
      const { fromDate, toDate } = fields;
      if (!files.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      const filePath = files.file.path;
      const dataRows = await parseExcel(filePath, fromDate, toDate);

      // Xoá dữ liệu cũ nếu trùng fromDate-toDate
      await pool.query('DELETE FROM weekly_reports WHERE from_date=$1 AND to_date=$2', [fromDate, toDate]);

      // Ghi dữ liệu mới
      for (const row of dataRows) {
        await pool.query(
          `INSERT INTO weekly_reports
            (group_code, group_name, sub_group_code, sub_group_name, task_name, ly_trinh, unit, thiet_ke, percent_week, percent_duan, note, from_date, to_date)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            row.group_code,
            row.group_name,
            row.sub_group_code,
            row.sub_group_name,
            row.task_name,
            row.ly_trinh,
            row.unit,
            row.thiet_ke,
            row.percent_week,
            row.percent_duan,
            row.note,
            row.fromDate,
            row.toDate
          ]
        );
      }
      res.json({ success: true, rows: dataRows.length });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
}
