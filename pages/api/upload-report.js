// pages/api/upload-report.js (Phiên bản cuối cùng, sửa lỗi không lưu tiến độ)
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

const sanitizeNumber = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(String(value).replace(/,/g, ''));
  return isNaN(number) ? null : number;
};

// Hàm xử lý PLHD.xlsx với logic làm sạch tên công việc
async function handleContractUpload(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = 'Mẫu số 11C';
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Không tìm thấy sheet '${sheetName}' trong PLHD.xlsx`);

  const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const headerRowIndex = data.findIndex(r => String(r[0] || '').trim().toUpperCase() === 'STT');
  if (headerRowIndex === -1) throw new Error("Không tìm thấy dòng tiêu đề 'STT' trong 'Mẫu số 11C'.");
  
  const headers = data[headerRowIndex].map(h => String(h || '').trim());
  const rows = data.slice(headerRowIndex + 1);

  const sttIdx = 0;
  const descIdx = headers.findIndex(h => h.toUpperCase().includes('TÊN CÔNG VIỆC'));
  const unitIdx = headers.findIndex(h => h.toUpperCase() === 'ĐƠN VỊ');
  const volumeIdx = headers.findIndex(h => h.toUpperCase() === 'KHỐI LƯỢNG');
  if ([descIdx, unitIdx, volumeIdx].some(i => i === -1)) throw new Error('Thiếu cột bắt buộc trong PLHD.xlsx (Tên công việc, Đơn vị, Khối lượng)');

  await sql`TRUNCATE TABLE progress_entries, weekly_reports, project_tasks RESTART IDENTITY CASCADE;`;
  
  let level1Id = null, level2Id = null;
  for (const row of rows) {
    const stt = String(row[sttIdx] || '').trim();
    const description = String(row[descIdx] || '').trim(); // <-- LÀM SẠCH TÊN CÔNG VIỆC
    if (!description || !stt) continue;

    const unit = row[unitIdx];
    const volume = sanitizeNumber(row[volumeIdx]);
    
    if (stt.match(/^[A-Z]$/)) {
      const res = await sql`INSERT INTO project_tasks (task_name, is_group, stt) VALUES (${description}, TRUE, ${stt}) RETURNING id;`;
      level1Id = res.rows[0].id;
    } else if (stt.match(/^[IVXLC]+$/)) {
      const res = await sql`INSERT INTO project_tasks (task_name, parent_id, is_group, stt) VALUES (${description}, ${level1Id}, TRUE, ${stt}) RETURNING id;`;
      level2Id = res.rows[0].id;
    } else if (!isNaN(Number(stt))) {
      await sql`INSERT INTO project_tasks (task_name, parent_id, contract_volume, unit, stt) VALUES (${description}, ${level2Id}, ${volume}, ${unit}, ${stt});`;
    }
  }
}

// Hàm xử lý Báo cáo tuần với logic làm sạch tên công việc
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
  const workDoneIdx = headers.findIndex(h => h.toUpperCase() === 'THỰC HIỆN');
  const cumulativeIdx = headers.findIndex(h => h.toUpperCase().includes('LŨY KẾ'));
  const notesIdx = headers.findIndex(h => h.toUpperCase() === 'GHI CHÚ');

  const reportResult = await sql`INSERT INTO weekly_reports (start_date, end_date) VALUES (${fromDate}, ${toDate}) ON CONFLICT (start_date, end_date) DO UPDATE SET end_date = EXCLUDED.end_date RETURNING id;`;
  const reportId = reportResult.rows[0].id;
  
  let progressInserted = 0;
  for (const row of rows) {
    const taskName = String(row[descIdx] || '').trim(); // <-- LÀM SẠCH TÊN CÔNG VIỆC
    const stt = String(row[0] || '').trim();

    if (taskName && !stt.match(/^[IVXLC]/i) && !stt.match(/\./)) {
      // So sánh các tên công việc đã được làm sạch
      const taskResult = await sql`SELECT id FROM project_tasks WHERE task_name = ${taskName} AND is_group = FALSE;`;
      if (taskResult.rows.length > 0) {
        const taskId = taskResult.rows[0].id;
        const workDone = sanitizeNumber(row[workDoneIdx]);
        const cumulativeWorkDone = sanitizeNumber(row[cumulativeIdx]);
        const notes = row[notesIdx] || '';
        await sql`INSERT INTO progress_entries (report_id, task_id, work_done_this_week, cumulative_work_done, notes) VALUES (${reportId}, ${taskId}, ${workDone}, ${cumulativeWorkDone}, ${notes}) ON CONFLICT (report_id, task_id) DO UPDATE SET work_done_this_week = EXCLUDED.work_done_this_week, cumulative_work_done = EXCLUDED.cumulative_work_done, notes = EXCLUDED.notes;`;
        progressInserted++;
      }
    }
  }
  if (progressInserted === 0) {
      console.warn("[BCT] Cảnh báo: Không có bản ghi tiến độ nào được lưu cho báo cáo này. Có thể tên công việc trong báo cáo tuần không khớp với tên trong file PLHD.");
  }
}

// Handler chính
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const form = formidable({});
  form.parse(req, async (err, fields, files) => {
    try {
      const file = files.file?.[0];
      const desiredFilename = fields.filename?.[0];
      if (!file || !desiredFilename) throw new Error('File hoặc loại file không hợp lệ.');
      
      await cloudinary.uploader.upload(file.filepath, { resource_type: 'raw', public_id: desiredFilename, overwrite: true });
      
      if (desiredFilename === 'PLHD.xlsx') {
        await handleContractUpload(file.filepath);
      } else if (desiredFilename === 'bao-cao-tuan.xlsx') {
        await handleWeeklyReportUpload(file.filepath, { fromDate: fields.fromDate?.[0], toDate: fields.toDate?.[0] });
      }
      
      res.status(200).json({ message: `Xử lý thành công file: ${desiredFilename}` });
    } catch (error) {
      console.error("Lỗi trong quá trình upload:", error);
      res.status(500).json({ error: error.message });
    }
  });
}