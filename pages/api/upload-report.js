// pages/api/upload-report.js (Phiên bản cuối cùng, dùng tên cột "Mô tả công việc")
import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';
import xlsx from 'xlsx';
import { sql } from '@vercel/postgres';

export const config = {
  api: {
    bodyParser: false,
  },
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const sanitizeNumber = (value) => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const number = Number(String(value).replace(/,/g, ''));
    return isNaN(number) ? null : number;
};

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

  // === SỬ DỤNG TÊN CỘT CHÍNH XÁC TUYỆT ĐỐI BẠN ĐÃ CUNG CẤP ===
  const STT_COL = 'STT';
  const DESC_COL = 'Mô tả công việc'; // TÊN CỘT ĐÚNG
  const UNIT_COL = 'Đơn vị tính';
  const VOLUME_COL = 'Khối lượng';
  // =============================================================

  const firstRow = contractData[0] || {};
  if (!(DESC_COL in firstRow) || !(UNIT_COL in firstRow) || !(VOLUME_COL in firstRow)) {
      throw new Error(`Thiếu cột bắt buộc. Các cột đọc được là: [${Object.keys(firstRow).join(', ')}]`);
  }
  
  await sql`TRUNCATE TABLE progress_entries, weekly_reports, project_tasks RESTART IDENTITY CASCADE;`;
  
  let lastLevel1Id = null;
  let lastLevel2Id = null;
  let tasksInserted = 0;

  for (const item of contractData) {
    const stt = String(item[STT_COL] || '').trim();
    const description = item[DESC_COL];
    
    if (!description || !stt) continue;

    const unit = item[UNIT_COL];
    const volume = sanitizeNumber(item[VOLUME_COL]);
    
    if (stt.match(/^[A-Z]$/)) { 
      const res = await sql`INSERT INTO project_tasks (task_name, is_group, stt) VALUES (${description}, TRUE, ${stt}) RETURNING id;`;
      level1Id = res.rows[0].id;
      tasksInserted++;
    } else if (stt.match(/^[IVXLC]+$/)) {
      const res = await sql`INSERT INTO project_tasks (task_name, parent_id, is_group, stt) VALUES (${description}, ${level1Id}, TRUE, ${stt}) RETURNING id;`;
      level2Id = res.rows[0].id;
      tasksInserted++;
    } else if (!isNaN(Number(stt))) {
      await sql`INSERT INTO project_tasks (task_name, parent_id, contract_volume, unit, stt) VALUES (${description}, ${level2Id}, ${volume}, ${unit}, ${stt});`;
      tasksInserted++;
    }
  }

  if (tasksInserted === 0) {
    throw new Error('Không có công việc nào được lưu từ file PLHD. Vui lòng kiểm tra lại cấu trúc STT (A, I, 1) trong file Excel.');
  }
}

async function handleWeeklyReportUpload(filePath, fields) {
  const { fromDate, toDate } = fields;
  if (!fromDate || !toDate) throw new Error('Thiếu thông tin ngày.');

  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('báo cáo tuần'));
  if (!sheetName) throw new Error('Không tìm thấy sheet báo cáo tuần.');
  const sheet = workbook.Sheets[sheetName];

  const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const headerRowIndex = data.findIndex(r => String(r[0]).trim().toUpperCase() === 'STT');
  if (headerRowIndex === -1) throw new Error("Không tìm thấy dòng tiêu đề 'STT' trong báo cáo tuần.");

  const headers = data[headerRowIndex].map(h => String(h || '').trim());
  const rows = data.slice(headerRowIndex + 1);

  const descIdx = headers.findIndex(h => h.toUpperCase().includes('CÔNG VIỆC'));
  const workDoneIdx = headers.findIndex(h => h === 'Thực hiện');
  const cumulativeIdx = headers.findIndex(h => h.includes('Lũy kế'));
  const notesIdx = headers.findIndex(h => h === 'Ghi chú');

  const reportResult = await sql`INSERT INTO weekly_reports (start_date, end_date) VALUES (${fromDate}, ${toDate}) ON CONFLICT (start_date, end_date) DO UPDATE SET end_date = EXCLUDED.end_date RETURNING id;`;
  const reportId = reportResult.rows[0].id;

  for (const row of rows) {
    const taskName = String(row[descIdx] || '').trim();
    const stt = String(row[0] || '').trim();
    if (taskName && !stt.match(/^[IVXLC]/i) && !stt.match(/\./)) {
      const taskResult = await sql`SELECT id FROM project_tasks WHERE task_name = ${taskName} AND is_group = FALSE;`;
      if (taskResult.rows.length > 0) {
        const workDone = sanitizeNumber(row[workDoneIdx]);
        const cumulativeWorkDone = sanitizeNumber(row[cumulativeIdx]);
        const notes = row[notesIdx] || '';
        await sql`INSERT INTO progress_entries (report_id, task_id, work_done_this_week, cumulative_work_done, notes) VALUES (${reportId}, ${taskResult.rows[0].id}, ${workDone}, ${cumulativeWorkDone}, ${notes}) ON CONFLICT (report_id, task_id) DO UPDATE SET work_done_this_week = EXCLUDED.work_done_this_week, cumulative_work_done = EXCLUDED.cumulative_work_done, notes = EXCLUDED.notes;`;
      }
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const form = formidable({});
  form.parse(req, async (err, fields, files) => {
    try {
      const file = files.file?.[0];
      const desiredFilename = fields.filename?.[0];
      if (!file || !desiredFilename) throw new Error('File hoặc loại file không hợp lệ.');
      await cloudinary.uploader.upload(file.filepath, { resource_type: 'raw', public_id: desiredFilename, overwrite: true });
      if (desiredFilename === 'PLHD.xlsx') await handleContractUpload(file.filepath);
      else if (desiredFilename === 'bao-cao-tuan.xlsx') await handleWeeklyReportUpload(file.filepath, { fromDate: fields.fromDate?.[0], toDate: fields.toDate?.[0] });
      res.status(200).json({ message: `Xử lý thành công file: ${desiredFilename}` });
    } catch (error) {
      console.error("Lỗi trong quá trình upload:", error);
      res.status(500).json({ error: error.message });
    }
  });
}