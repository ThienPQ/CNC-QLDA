// pages/api/upload-report.js (Phiên bản cuối cùng, đọc đúng cấu trúc A -> I -> 1)
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

  const sttIdx = headers.findIndex(h => h.toUpperCase() === 'STT');
  const descIdx = headers.findIndex(h => h.toUpperCase().includes('TÊN CÔNG VIỆC'));
  const unitIdx = headers.findIndex(h => h.toUpperCase() === 'ĐƠN VỊ');
  const volumeIdx = headers.findIndex(h => h.toUpperCase() === 'KHỐI LƯỢNG');
  if ([sttIdx, descIdx, unitIdx, volumeIdx].some(i => i === -1)) throw new Error('Thiếu cột bắt buộc: STT, Tên công việc, Đơn vị, Khối lượng.');

  const contractData = dataRows.map(row => ({
    stt: String(row[sttIdx] || '').trim(),
    description: row[descIdx],
    unit: row[unitIdx],
    volume: row[volumeIdx],
  }));

  await sql`TRUNCATE TABLE progress_entries, weekly_reports, project_tasks RESTART IDENTITY CASCADE;`;

  let level1Id = null, level2Id = null, tasksInserted = 0;

  for (const item of contractData) {
    if (!item.description || !item.stt) continue;
    
    // Logic phân cấp mới, chính xác
    if (item.stt.match(/^[A-Z]$/)) { // Cấp 1: A, B, C...
      const res = await sql`INSERT INTO project_tasks (task_name, is_group, stt) VALUES (${item.description}, TRUE, ${item.stt}) RETURNING id;`;
      level1Id = res.rows[0].id; tasksInserted++;
    } else if (item.stt.match(/^[IVXLC]+$/)) { // Cấp 2: I, II, III...
      const res = await sql`INSERT INTO project_tasks (task_name, parent_id, is_group, stt) VALUES (${item.description}, ${level1Id}, TRUE, ${item.stt}) RETURNING id;`;
      level2Id = res.rows[0].id; tasksInserted++;
    } else if (!isNaN(Number(item.stt))) { // Cấp 3: 1, 2, 3...
      await sql`INSERT INTO project_tasks (task_name, parent_id, contract_volume, unit, stt) VALUES (${item.description}, ${level2Id}, ${item.volume}, ${item.unit}, ${item.stt});`;
      tasksInserted++;
    }
  }

  if (tasksInserted === 0) {
    throw new Error('Không có công việc nào được lưu từ file PLHD. Vui lòng kiểm tra lại cấu trúc STT (A, I, 1) và tên các cột trong file Excel.');
  }
}

async function handleWeeklyReportUpload(filePath, fields) {
  const fromDate = fields.fromDate?.[0], toDate = fields.toDate?.[0];
  if (!fromDate || !toDate) throw new Error('Thiếu thông tin ngày.');

  const workbook = xlsx.readFile(filePath);
  const targetSheetName = workbook.SheetNames.find(name => name.trim().toLowerCase().includes('báo cáo tuần')) || workbook.SheetNames[0];
  if (!targetSheetName) throw new Error('Không tìm thấy sheet báo cáo hợp lệ.');
  
  const sheet = workbook.Sheets[targetSheetName];
  const allData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const headerRowIndex = allData.findIndex(row => String(row[0] || '').trim().toUpperCase() === 'STT');
  if (headerRowIndex === -1) throw new Error("Không tìm thấy dòng tiêu đề 'STT' trong báo cáo tuần.");
  
  const headers = allData[headerRowIndex].map(h => String(h || '').trim());
  const reportData = allData.slice(headerRowIndex + 1).map(row => {
    let obj = {};
    headers.forEach((h, i) => { if(h) obj[h] = row[i]; });
    return obj;
  });

  const reportResult = await sql`INSERT INTO weekly_reports (start_date, end_date) VALUES (${fromDate}, ${toDate}) ON CONFLICT (start_date, end_date) DO UPDATE SET end_date = EXCLUDED.end_date RETURNING id;`;
  const reportId = reportResult.rows[0].id;
  
  for (const row of reportData) {
    const taskName = row['Hạng mục công việc'] || row['CÔNG VIỆC'];
    const workDone = row['Thực hiện'];
    const notes = row['Ghi chú'];
    if (taskName) {
      const taskResult = await sql`SELECT id FROM project_tasks WHERE task_name = ${taskName} AND is_group = FALSE;`;
      if (taskResult.rows.length > 0) {
        const taskId = taskResult.rows[0].id;
        await sql`INSERT INTO progress_entries (report_id, task_id, work_done_this_week, notes) VALUES (${reportId}, ${taskId}, ${workDone || 0}, ${notes || ''}) ON CONFLICT (report_id, task_id) DO UPDATE SET work_done_this_week = EXCLUDED.work_done_this_week, notes = EXCLUDED.notes;`;
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
      else if (desiredFilename === 'bao-cao-tuan.xlsx') await handleWeeklyReportUpload(file.filepath, fields);
      res.status(200).json({ message: `Tải lên và xử lý thành công file: ${desiredFilename}` });
    } catch (error) {
      console.error("Lỗi trong quá trình upload:", error);
      res.status(500).json({ error: error.message });
    }
  });
}