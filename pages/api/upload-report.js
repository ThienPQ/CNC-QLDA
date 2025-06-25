import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';
import xlsx from 'xlsx';
import { sql } from '@vercel/postgres';

export const config = { api: { bodyParser: false } };
cloudinary.config({ /* ... */ });

export default async function handler(req, res) {
  const form = formidable({});
  form.parse(req, async (err, fields, files) => {
    try {
      console.log("[UPLOAD-API] Bắt đầu xử lý upload.");
      const file = files.file?.[0];
      const desiredFilename = fields.filename?.[0];
      if (!file || !['bao-cao-tuan.xlsx', 'PLHD.xlsx'].includes(desiredFilename)) {
        throw new Error('File hoặc loại file không hợp lệ.');
      }

      await cloudinary.uploader.upload(file.filepath, { /* ... */ });

      if (desiredFilename === 'bao-cao-tuan.xlsx') {
        const workbook = xlsx.readFile(file.filepath);
        const targetSheetName = workbook.SheetNames.filter(name => !/^Sheet\d+$/i.test(name)).pop();
        const sheet = workbook.Sheets[targetSheetName];
        const tableData = xlsx.utils.sheet_to_json(sheet, { range: 'A34:Q90', header: 1 });
        
        const headers = tableData[0] || [];
        const rowsAsArrays = tableData.slice(1).filter(row => row.length > 0 && row[0] !== '');
        
        // --- LOG ĐỂ DEBUG ---
        console.log("[UPLOAD-API] Các headers được đọc từ Excel:", JSON.stringify(headers));
        console.log("[UPLOAD-API] Dòng dữ liệu đầu tiên (dạng mảng):", JSON.stringify(rowsAsArrays[0]));
        // --- KẾT THÚC LOG ---
        
        let conclusion = '';
        let recommendation = '';
        const fullSheetData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        fullSheetData.forEach(row => { /* ... */ });
        
        await sql`CREATE TABLE IF NOT EXISTS reports (...)`;
        await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS headers_data JSONB;`;
        await sql`DELETE FROM reports;`;
        
        console.log("[UPLOAD-API] Chuẩn bị lưu vào database.");
        await sql`INSERT INTO reports (headers_data, report_data, conclusion, recommendation) VALUES (${JSON.stringify(headers)}, ${JSON.stringify(rowsAsArrays)}, ${conclusion}, ${recommendation});`;
        console.log("[UPLOAD-API] Đã lưu vào database thành công.");
      }
      
      res.status(200).json({ message: `Tải lên và xử lý thành công file: ${desiredFilename}` });
    } catch (error) {
      console.error("[UPLOAD-API] Lỗi nghiêm trọng:", error);
      res.status(500).json({ error: error.message });
    }
  });
}