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

// Hàm xử lý upload file kế hoạch hợp đồng (PLHD.xlsx)
async function handleContractUpload(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = 'Mẫu số 11C';
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Không tìm thấy sheet có tên '${sheetName}' trong file PLHD.xlsx`);
  }

  const allSheetData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

  const headerRowIndex = allSheetData.findIndex(row => String(row[0] || '').trim().toUpperCase() === 'STT');
  if (headerRowIndex === -1) {
    throw new Error("Không tìm thấy dòng tiêu đề (bắt đầu bằng 'STT') trong sheet 'Mẫu số 11C'.");
  }

  const headers = allSheetData[headerRowIndex].map(h => String(h || '').trim());
  const dataRows = allSheetData.slice(headerRowIndex + 1);

  const contractData = dataRows.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      if (header) obj[header] = row[index];
    });
    return obj;
  });

  // Sử dụng chính xác tên cột bạn đã cung cấp
  const STT_COL = 'STT';
  const DESC_COL = 'Tên công việc và quy cách vật liệu';
  const UNIT_COL = 'Đơn vị';
  const VOLUME_COL = 'Khối lượng';

  // Dọn dẹp database trước khi thêm mới
  await sql`TRUNCATE TABLE progress_entries, weekly_reports, project_tasks RESTART IDENTITY CASCADE;`;

  let lastLevel1Id = null;
  let lastLevel2Id = null;
  let tasksInserted = 0;

  for (const item of contractData) {
    const stt = String(item[STT_COL] || '').trim();
    const description = item[DESC_COL];
    
    if (!description || !stt) continue;

    const unit = item[UNIT_COL];
    const volume = item[VOLUME_COL];

    if (stt.match(/^[IVXLC]+$/)) { // Cấp 1: Hạng mục lớn (I, II, ...)
      const res = await sql`INSERT INTO project_tasks (task_name, is_group, stt) VALUES (${description}, TRUE, ${stt}) RETURNING id;`;
      lastLevel1Id = res.rows[0].id;
      tasksInserted++;
    } else if (stt.match(/^\d+\.\d+$/)) { // Cấp 2: Nhóm con (1.1, 1.2, ...)
      const res = await sql`INSERT INTO project_tasks (task_name, parent_id, is_group, stt) VALUES (${description}, ${lastLevel1Id}, TRUE, ${stt}) RETURNING id;`;
      lastLevel2Id = res.rows[0].id;
      tasksInserted++;
    } else if (stt.match(/^\d+\.\d+\.\d+$/) || !isNaN(Number(stt))) { // Cấp 3 hoặc số thường
      await sql`INSERT INTO project_tasks (task_name, parent_id, contract_volume, unit, stt) VALUES (${description}, ${lastLevel2Id}, ${volume}, ${unit}, ${stt});`;
      tasksInserted++;
    }
  }

  if (tasksInserted === 0) {
    throw new Error('Không có công việc nào được lưu từ file PLHD. Vui lòng kiểm tra lại cấu trúc file và tên cột.');
  }
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
  // Đọc từ A8 để lấy header chuẩn
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
    // Chỉ xử lý các công việc chi tiết (có tên)
    if (taskName) {
      const taskResult = await sql`SELECT id FROM project_tasks WHERE task_name = ${taskName} AND is_group = FALSE;`;
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

      // Tải file lên Cloudinary
      await cloudinary.uploader.upload(file.filepath, { resource_type: 'raw', public_id: desiredFilename, overwrite: true });

      // Xử lý file dựa trên loại đã chọn
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