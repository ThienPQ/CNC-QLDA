// pages/api/upload-report.js
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

// Hàm xử lý khi upload file kế hoạch hợp đồng
async function handleContractUpload(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const contractData = xlsx.utils.sheet_to_json(sheet);

  // Tạo bảng nếu chưa có
  await sql`CREATE TABLE IF NOT EXISTS contract_items (id SERIAL PRIMARY KEY, item_name TEXT UNIQUE, design_volume NUMERIC, unit TEXT);`;
  // Xóa kế hoạch cũ để cập nhật mới
  await sql`DELETE FROM contract_items;`;

  for (const item of contractData) {
    const itemName = item['Hạng mục công việc'];
    const designVolume = item['Khối lượng theo HĐ'];
    const unit = item['Đơn vị'];
    if (itemName) {
      await sql`
        INSERT INTO contract_items (item_name, design_volume, unit) 
        VALUES (${itemName}, ${designVolume}, ${unit})
        ON CONFLICT (item_name) DO UPDATE SET design_volume = EXCLUDED.design_volume, unit = EXCLUDED.unit;
      `;
    }
  }
}

// Hàm xử lý khi upload báo cáo tuần
async function handleWeeklyReportUpload(filePath, fields) {
  const fromDate = fields.fromDate?.[0];
  const toDate = fields.toDate?.[0];
  if (!fromDate || !toDate) throw new Error('Cần có đủ thông tin "Từ ngày" và "Đến ngày".');

  const workbook = xlsx.readFile(filePath);
  const targetSheetName = workbook.SheetNames.filter(name => name.trim().toLowerCase().startsWith('bc tuần')).pop() 
                       || workbook.SheetNames.filter(name => !/^Sheet\d+$/i.test(name)).pop();
  
  if (!targetSheetName) throw new Error('Không tìm thấy sheet báo cáo hợp lệ trong file Excel.');
  
  const sheet = workbook.Sheets[targetSheetName];
  // Đọc toàn bộ dữ liệu gốc từ vùng A34:Q90
  const allData = xlsx.utils.sheet_to_json(sheet, { range: 'A34:Q90', header: 1, defval: '' });
  if (!allData || allData.length < 1) throw new Error('Không có dữ liệu trong vùng A34:Q90 của sheet đã chọn.');
  
  // Lưu toàn bộ dữ liệu thô này vào database
  const reportContent = JSON.stringify(allData);
  
  // Tạo bảng reports nếu chưa có
  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      week_start_date DATE NOT NULL,
      week_end_date DATE NOT NULL,
      raw_data JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(week_start_date, week_end_date)
    );
  `;
  
  // Thêm báo cáo mới hoặc cập nhật nếu cùng khoảng thời gian
  await sql`
    INSERT INTO reports (week_start_date, week_end_date, raw_data)
    VALUES (${fromDate}, ${toDate}, ${reportContent})
    ON CONFLICT (week_start_date, week_end_date) DO UPDATE SET raw_data = EXCLUDED.raw_data;
  `;
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

      // Tải lên Cloudinary để lưu trữ
      await cloudinary.uploader.upload(file.filepath, {
        resource_type: 'raw', public_id: desiredFilename, overwrite: true,
      });

      // Xử lý và lưu vào DB tùy theo loại file
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