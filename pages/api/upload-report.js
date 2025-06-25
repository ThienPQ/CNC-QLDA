import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';
import xlsx from 'xlsx';
import { sql } from '@vercel/postgres';

export const config = { api: { bodyParser: false } };
cloudinary.config({ /* ... */ }); // Giữ nguyên cấu hình

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const form = formidable({});
  form.parse(req, async (err, fields, files) => {
    try {
      const file = files.file?.[0];
      const desiredFilename = fields.filename?.[0];
      if (!file || !['bao-cao-tuan.xlsx', 'PLHD.xlsx'].includes(desiredFilename)) {
        throw new Error('File hoặc loại file không hợp lệ.');
      }
      await cloudinary.uploader.upload(file.filepath, { /* ... */ });

      if (desiredFilename === 'bao-cao-tuan.xlsx') {
        const workbook = xlsx.readFile(file.filepath);
        const targetSheetName = workbook.SheetNames.filter(name => !/^Sheet\d+$/i.test(name)).pop();
        if (!targetSheetName) throw new Error('Không tìm thấy sheet hợp lệ.');
        
        const sheet = workbook.Sheets[targetSheetName];
        const allData = xlsx.utils.sheet_to_json(sheet, { range: 'A34:Q90', header: 1 });
        
        // --- LOGIC LỌC CỘT MỚI ---
        const originalHeaders = allData[0] || [];
        const desiredHeaders = [
            'STT', 'CÔNG VIỆC', 'LÝ TRÌNH', 'ĐƠN VỊ', 
            '% Hoàn thành trong tuần', '% Hoàn thiện theo dự án', 'Ghi chú'
        ];

        // Tìm chỉ số (index) của các cột cần giữ lại
        const indicesToKeep = desiredHeaders.map(dh => 
            originalHeaders.findIndex(oh => String(oh).trim() === dh)
        );

        // Lọc lại mảng headers để có đúng thứ tự mong muốn
        const newHeaders = desiredHeaders;
        
        // Lọc lại dữ liệu của mỗi hàng để chỉ giữ lại các cột tương ứng
        const newRowsAsArrays = allData.slice(1)
            .filter(row => row.length > 0 && row[0] !== null && row[0] !== '')
            .map(row => indicesToKeep.map(index => (index === -1 ? '' : row[index])));
        // --- KẾT THÚC LOGIC LỌC CỘT ---

        await sql`CREATE TABLE IF NOT EXISTS reports (...)`; // DDL
        await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS headers_data JSONB;`;
        
        await sql`DELETE FROM reports;`;
        await sql`
          INSERT INTO reports (headers_data, report_data, conclusion, recommendation)
          VALUES (${JSON.stringify(newHeaders)}, ${JSON.stringify(newRowsAsArrays)}, '', '');
        `; // Kết luận và kiến nghị sẽ không còn nữa
      }
      
      res.status(200).json({ message: `Tải lên và xử lý thành công file: ${desiredFilename}` });
    } catch (error) {
      console.error("Lỗi trong quá trình upload và xử lý:", error);
      res.status(500).json({ error: error.message });
    }
  });
}