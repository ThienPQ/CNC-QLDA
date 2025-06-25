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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const form = formidable({});
  form.parse(req, async (err, fields, files) => {
    try {
      if (err) throw new Error('Lỗi khi parse form data.');

      const file = files.file?.[0];
      const desiredFilename = fields.filename?.[0];
      if (!file || !['bao-cao-tuan.xlsx', 'PLHD.xlsx'].includes(desiredFilename)) {
        throw new Error('File hoặc loại file không hợp lệ.');
      }

      await cloudinary.uploader.upload(file.filepath, {
        resource_type: 'raw',
        public_id: desiredFilename,
        overwrite: true,
      });

      if (desiredFilename === 'bao-cao-tuan.xlsx') {
        const workbook = xlsx.readFile(file.filepath);
        const targetSheetName = workbook.SheetNames.filter(name => !/^Sheet\d+$/i.test(name)).pop();
        if (!targetSheetName) throw new Error('Không tìm thấy sheet hợp lệ trong file Excel.');
        
        const sheet = workbook.Sheets[targetSheetName];
        const tableData = xlsx.utils.sheet_to_json(sheet, { range: 'A34:Q90', header: 1 });
        const fullSheetData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        const headers = tableData[0] || []; // Lấy mảng headers theo đúng thứ tự
        const rows = tableData.slice(1).map(row => {
          let obj = {};
          headers.forEach((header, i) => { if (header) obj[String(header)] = row[i] || ''; });
          return obj;
        }).filter(obj => Object.keys(obj).length > 0 && obj[Object.keys(obj)[0]] !== '');
        
        let conclusion = '';
        let recommendation = '';
        fullSheetData.forEach(row => {
          if (row && typeof row[0] === 'string') {
            const firstCell = row[0].trim().toUpperCase();
            if (firstCell.includes('KẾT LUẬN')) conclusion = row[1] || '';
            if (firstCell.includes('KIẾN NGHỊ')) recommendation = row[1] || '';
          }
        });
        
        // Cập nhật cấu trúc bảng để thêm cột headers_data
        await sql`
          CREATE TABLE IF NOT EXISTS reports (
            id SERIAL PRIMARY KEY,
            headers_data JSONB, -- Thêm cột này
            report_data JSONB,
            conclusion TEXT,
            recommendation TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `;
        // Thêm cột nếu chưa có (dành cho trường hợp bảng đã tồn tại)
        try {
          await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS headers_data JSONB;`;
        } catch (e) { console.log("Column headers_data already exists or another alter error."); }

        await sql`DELETE FROM reports;`;
        // Lưu cả headers và rows vào database
        await sql`
          INSERT INTO reports (headers_data, report_data, conclusion, recommendation)
          VALUES (${JSON.stringify(headers)}, ${JSON.stringify(rows)}, ${conclusion}, ${recommendation});
        `;
      }
      
      res.status(200).json({ message: `Tải lên và xử lý thành công file: ${desiredFilename}` });

    } catch (error) {
      console.error("Lỗi trong quá trình upload và xử lý:", error);
      res.status(500).json({ error: error.message });
    }
  });
}