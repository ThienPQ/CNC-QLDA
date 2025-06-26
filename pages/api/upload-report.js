// pages/api/upload-report.js
import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';
import xlsx from 'xlsx';
import { sql } from '@vercel/postgres';

export const config = { api: { bodyParser: false } };

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Hàm xử lý upload file kế hoạch hợp đồng (PLHD.xlsx)
async function handleContractUpload(filePath) {
  console.log("[PLHD-DEBUG] Bắt đầu xử lý file kế hoạch...");
  const workbook = xlsx.readFile(filePath);
  const sheetName = 'TH'; // Giả sử sheet kế hoạch chính xác tên là 'TH'
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Không tìm thấy sheet có tên '${sheetName}' trong file PLHD.xlsx`);
  
  const contractData = xlsx.utils.sheet_to_json(sheet);
  console.log(`[PLHD-DEBUG] Đã đọc được ${contractData.length} dòng từ sheet '${sheetName}'.`);

  // Log để debug tên cột
  if (contractData.length > 0) {
    console.log("[PLHD-DEBUG] Tên các cột đọc được từ file Excel là:", Object.keys(contractData[0]));
  }

  // Dọn dẹp bảng cũ để đảm bảo dữ liệu luôn mới nhất
  await sql`TRUNCATE TABLE progress_entries, weekly_reports, project_tasks RESTART IDENTITY CASCADE;`;
  console.log("[PLHD-DEBUG] Đã dọn dẹp các bảng cũ.");

  let lastParentId = null;
  let tasksInserted = 0;

  for (const item of contractData) {
    const taskName = item['Hạng mục'];
    const designVolume = item['KL Gói thầu'];
    const unit = item['ĐVT'];
    const stt = String(item['STT'] || '').trim();

    if (!taskName) continue;

    let parentId = null;
    let isGroup = false;

    if (stt.match(/^[IVXLC]+$/)) { // Là mục La Mã
      isGroup = true;
      const result = await sql`INSERT INTO project_tasks (task_name, is_group) VALUES (${taskName}, ${isGroup}) RETURNING id;`;
      lastParentId = result.rows[0].id;
      tasksInserted++;
    } else { // Là mục con
      parentId = lastParentId;
      await sql`INSERT INTO project_tasks (task_name, parent_task_id, design_volume, unit) VALUES (${taskName}, ${parentId}, ${designVolume}, ${unit});`;
      tasksInserted++;
    }
  }
  console.log(`[PLHD-DEBUG] Đã lưu thành công ${tasksInserted} công việc/nhóm vào database.`);
}

// Hàm xử lý upload báo cáo tuần
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

  const reportResult = await sql`
    INSERT INTO weekly_reports (start_date, end_date)
    VALUES (${fromDate}, ${toDate})
    ON CONFLICT (start_date, end_date) DO UPDATE SET end_date = EXCLUDED.end_date
    RETURNING id;
  `;
  const reportId = reportResult.rows[0].id;

  for (const row of reportData) {
    const taskName = row['CÔNG VIỆC'];
    const workDone = row['Thực hiện'];
    const notes = row['Ghi chú'];
    const stt = String(row['STT'] || '').trim();

    if (taskName && !stt.match(/^[IVXLC]/) && !stt.match(/\./)) {
      const taskResult = await sql`SELECT id FROM project_tasks WHERE task_name = ${taskName};`;
      if (taskResult.rows.length > 0) {
        const taskId = taskResult.rows[0].id;
        
        await sql`
          INSERT INTO progress_entries (report_id, task_id, work_done_this_week, notes)
          VALUES (${reportId}, ${taskId}, ${workDone || 0}, ${notes || ''})
          ON CONFLICT (report_id, task_id) DO UPDATE SET work_done_this_week = EXCLUDED.work_done_this_week, notes = EXCLUDED.notes;
        `;
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
      
      res.status(200).json({ message: `Tải lên và xử lý thành công file: ${desiredFilename}` });
    } catch (error) {
      console.error("Lỗi trong quá trình upload và xử lý:", error);
      res.status(500).json({ error: error.message });
    }
  });
}