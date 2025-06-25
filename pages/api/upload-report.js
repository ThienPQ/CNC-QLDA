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
        if (!targetSheetName) throw new Error('Không tìm thấy sheet hợp lệ.');
        
        const sheet = workbook.Sheets[targetSheetName];
        const allData = xlsx.utils.sheet_to_json(sheet, { range: 'A34:Q90', header: 1, defval: '' });
        if (!allData || allData.length < 1) throw new Error('Không có dữ liệu trong vùng A34:Q90.');
        
        const originalHeaders = allData[0].map(h => String(h || '').trim());
        
        // Chỉ định 7 cột cần giữ lại
        const desiredHeaders = [ 'STT', 'CÔNG VIỆC', 'LÝ TRÌNH', 'ĐƠN VỊ', '% Hoàn thành trong tuần', '% Hoàn thiện theo dự án', 'Ghi chú' ];

        // Tìm chỉ số của các cột này trong file gốc
        const indicesToKeep = desiredHeaders.map(dh => {
          const index = originalHeaders.findIndex(oh => oh.toUpperCase() === dh.toUpperCase());
          if (index === -1) throw new Error(`Không tìm thấy cột bắt buộc: "${dh}"`);
          return index;
        });

        // Tạo dữ liệu mới chỉ chứa 7 cột đã chọn
        const newRowsAsArrays = allData.slice(1)
            .filter(row => row.length > 0 && String(row[0] || '').trim() !== '')
            .map(row => indicesToKeep.map(index => row[index]));
            
        await sql`CREATE TABLE IF NOT EXISTS reports (id SERIAL PRIMARY KEY, headers_data JSONB, report_data JSONB, conclusion TEXT, recommendation TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);`;
        
        await sql`DELETE FROM reports;`;
        // Lưu dữ liệu đã được lọc (chỉ 7 cột) vào DB
        await sql`
          INSERT INTO reports (headers_data, report_data, conclusion, recommendation)
          VALUES (${JSON.stringify(desiredHeaders)}, ${JSON.stringify(newRowsAsArrays)}, '', '');
        `;
      }
      
      res.status(200).json({ message: `Tải lên và xử lý thành công file: ${desiredFilename}` });
    } catch (error) {
      console.error("Lỗi trong quá trình upload và xử lý:", error);
      res.status(500).json({ error: error.message });
    }
  });
}