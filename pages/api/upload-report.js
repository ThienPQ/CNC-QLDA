// pages/api/upload-report.js (Phiên bản cuối cùng, đã sửa lỗi 'sanitizeNumber is not defined')
import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';
import xlsx from 'xlsx';
import { sql } from '@vercel/postgres';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// === HÀM HELPER ĐƯỢC ĐẶT Ở ĐÂY ĐỂ TOÀN BỘ FILE CÓ THỂ SỬ DỤNG ===
// Hàm "làm sạch" giá trị số, chuyển ô trống hoặc chữ thành null
const sanitizeNumber = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null; // Chuyển ô trống hoặc rỗng thành NULL
  }
  // Bỏ dấu phẩy ngăn cách hàng nghìn nếu có
  const number = Number(String(value).replace(/,/g, ''));
  return isNaN(number) ? null : number; // Nếu không phải số, cũng chuyển thành NULL
};

// Hàm kiểm tra định dạng ngày YYYY-MM-DD
function isValidDate(dateString) {
  if (!dateString) return false;
  const regEx = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateString.match(regEx)) return false;
  const d = new Date(dateString);
  const dNum = d.getTime();
  if (!dNum && dNum !== 0) return false;
  return d.toISOString().slice(0, 10) === dateString;
}
// =================================================================

// Hàm xử lý upload file kế hoạch hợp đồng (PLHD.xlsx)
async function handleContractUpload(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = 'Mẫu số 11C';
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Không tìm thấy sheet có tên '${sheetName}' trong file PLHD.xlsx`);

  const allSheetData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const headerRowIndex = allSheetData.findIndex(row => String(row[0] || '').trim().toUpperCase() === 'STT');
  if (headerRowIndex === -1) throw new Error("Không tìm thấy dòng tiêu đề (bắt đầu bằng 'STT') trong sheet 'Mẫu số 11C'.");

  const dataRows = allSheetData.slice(headerRowIndex + 1);

  await sql`TRUNCATE TABLE progress_entries, weekly_reports, project_tasks RESTART IDENTITY CASCADE;`;

  let lastLevel1Id = null;
  let lastLevel2Id = null;

  for (const row of dataRows) {
    const stt = String(row[0] || '').trim();
    const description = row[1];
    const unit = row[2];
    const volume = sanitizeNumber(row[3]); // Sử dụng hàm làm sạch

    if (!description || !stt) continue;

    if (stt.match(/^[A-Z]$/)) {
        const res = await sql`INSERT INTO project_tasks (task_name, is_group, stt) VALUES (${description}, TRUE, ${stt}) RETURNING id;`;
        lastLevel1Id = res.rows[0].id;
    } else if (stt.match(/^[IVXLC]+$/)) {
        const res = await sql`INSERT INTO project_tasks (task_name, parent_id, is_group, stt) VALUES (${description}, ${lastLevel1Id}, TRUE, ${stt}) RETURNING id;`;
        lastLevel2Id = res.rows[0].id;
    } else if (!isNaN(Number(stt))) {
        await sql`INSERT INTO project_tasks (task_name, parent_id, contract_volume, unit, stt) VALUES (${description}, ${lastLevel2Id}, ${volume}, ${unit}, ${stt});`;
    }
  }
}

// Hàm xử lý upload báo cáo tuần
async function handleWeeklyReportUpload(filePath, fields) {
  const fromDate = fields.fromDate?.[0];
  const toDate = fields.toDate?.[0];

  if (!isValidDate(fromDate) || !isValidDate(toDate)) {
    throw new Error(`Ngày tháng không hợp lệ. Hệ thống nhận được fromDate='${fromDate}' và toDate='${toDate}'.`);
  }

  const workbook = xlsx.readFile(filePath);
  const targetSheetName = workbook.SheetNames.find(name => name.trim().toLowerCase().includes('báo cáo tuần')) 
                       || workbook.SheetNames.filter(name => !/^Sheet\d+$/i.test(name)).pop();
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
    const taskName = row['CÔNG VIỆC'] || row['Hạng mục công việc'];
    const workDone = sanitizeNumber(row['Thực hiện']);
    const cumulativeWorkDone = sanitizeNumber(row['Lũy kế đến nay']);
    const notes = row['Ghi chú'];
    if (taskName) {
      const taskResult = await sql`SELECT id FROM project_tasks WHERE task_name = ${taskName} AND is_group = FALSE;`;
      if (taskResult.rows.length > 0) {
        const taskId = taskResult.rows[0].id;
        await sql`INSERT INTO progress_entries (report_id, task_id, work_done_this_week, cumulative_work_done, notes) VALUES (${reportId}, ${taskId}, ${workDone}, ${cumulativeWorkDone}, ${notes || ''}) ON CONFLICT (report_id, task_id) DO UPDATE SET work_done_this_week = EXCLUDED.work_done_this_week, cumulative_work_done = EXCLUDED.cumulative_work_done, notes = EXCLUDED.notes;`;
      }
    }
  }
}

// Handler chính của API
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
        await handleWeeklyReportUpload(file.filepath, fields);
      }
      
      res.status(200).json({ message: `Xử lý thành công file: ${desiredFilename}` });
    } catch (error) {
      console.error("Lỗi trong quá trình upload:", error);
      res.status(500).json({ error: error.message });
    }
  });
}