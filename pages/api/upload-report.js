// pages/api/upload-report.js (Phiên bản cuối cùng, đã sửa lỗi INSERT)
import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';
import xlsx from 'xlsx';
import { sql } from '@vercel/postgres';

export const config = { api: { bodyParser: false } };

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Hàm xử lý upload file kế hoạch hợp đồng (PLHD.xlsx)
async function handleContractUpload(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = 'Mẫu số 11C';
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Không tìm thấy sheet có tên '${sheetName}' trong file PLHD.xlsx`);

  const allSheetData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const headerRowIndex = allSheetData.findIndex(row => String(row[0] || '').trim().toUpperCase() === 'STT');
  if (headerRowIndex === -1) throw new Error("Không tìm thấy dòng tiêu đề (bắt đầu bằng 'STT') trong sheet 'Mẫu số 11C'.");

  const headers = allSheetData[headerRowIndex].map(h => String(h || '').trim());
  const dataRows = allSheetData.slice(headerRowIndex + 1);

  const contractData = dataRows.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      if (header) obj[header] = row[index];
    });
    return obj;
  });

  const STT_COL = 'STT';
  const DESC_COL = 'Mô tả công việc mời thầu';
  const UNIT_COL = 'Đơn vị tính';
  const VOLUME_COL = 'Khối lượng';

  await sql`TRUNCATE TABLE progress_entries, weekly_reports, project_tasks RESTART IDENTITY CASCADE;`;

  let lastLevel1Id = null;
  let lastLevel2Id = null;

  for (const item of contractData) {
    const stt = String(item[STT_COL] || '').trim();
    const description = item[DESC_COL];
    
    if (!description || !stt) continue;

    const unit = item[UNIT_COL];
    const volume = item[VOLUME_COL];

    if (stt.match(/^[IVXLC]+$/)) {
      const res = await sql`INSERT INTO project_tasks (task_name, is_group, stt) VALUES (${description}, TRUE, ${stt}) RETURNING id;`;
      lastLevel1Id = res.rows[0].id;
    } else if (stt.match(/^\d+\.\d+$/)) {
      const res = await sql`INSERT INTO project_tasks (task_name, parent_id, is_group, stt) VALUES (${description}, ${lastLevel1Id}, TRUE, ${stt}) RETURNING id;`;
      lastLevel2Id = res.rows[0].id;
    } else if (stt.match(/^\d+\.\d+\.\d+$/)) {
      // === SỬA LỖI Ở ĐÂY: Thêm giá trị `stt` vào câu lệnh INSERT ===
      await sql`
        INSERT INTO project_tasks (task_name, parent_id, contract_volume, unit, stt) 
        VALUES (${description}, ${lastLevel2Id}, ${volume}, ${unit}, ${stt});
      `;
      // ========================================================
    }
  }
}

// Hàm xử lý upload báo cáo tuần (không thay đổi)
async function handleWeeklyReportUpload(filePath, fields) {
  const fromDate = fields.fromDate?.[0];
  const toDate = fields.toDate?.[0];
  if (!fromDate || !toDate) throw new Error('Cần có đủ thông tin "Từ ngày" và "Đến ngày".');

  const workbook = xlsx.readFile(filePath);
  const targetSheetName = workbook.SheetNames.find(name => name.trim().toLowerCase().startsWith('báo cáo tuần')) 
                       || workbook.SheetNames.filter(name => !/^Sheet\d+$/i.test(name)).pop();
  if (!targetSheetName) throw new Error('Không tìm thấy sheet báo cáo hợp lệ.');
  
  const sheet = workbook.Sheets[targetSheetName];
  const reportData = xlsx.utils.sheet_to_json(sheet, { range: 'A8', defval: '' });

  const reportResult = await sql`INSERT INTO weekly_reports (start_date, end_date) VALUES (${fromDate}, ${toDate}) ON CONFLICT (start_date, end_date) DO UPDATE SET end_date = EXCLUDED.end_date RETURNING id;`;
  const reportId = reportResult.rows[0].id;

  for (const row of reportData)