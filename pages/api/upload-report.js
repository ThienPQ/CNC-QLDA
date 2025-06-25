// pages/api/upload-report.js (Phiên bản cuối cùng, đã sửa lỗi API Key)
import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';
import xlsx from 'xlsx';
import { sql } from '@vercel/postgres';

export const config = { api: { bodyParser: false } };

// PHẦN CẤU HÌNH ĐẦY ĐỦ VÀ ĐÚNG
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

      // 1. Tải file lên Cloudinary
      await cloudinary.uploader.upload(file.filepath, {
        resource_type: 'raw',
        public_id: desiredFilename,
        overwrite: true,
      });

      // 2. Nếu là file báo cáo tuần, đọc, lọc và lưu vào DB
      if (desiredFilename === 'bao-cao-tuan.xlsx') {
        const workbook = xlsx.readFile(file.filepath);
        const targetSheetName = workbook.SheetNames.filter(name => !/^Sheet\d+$/i.test(name)).pop();
        if (!targetSheetName) throw new Error('Không tìm thấy sheet hợp lệ trong file Excel.');
        
        const sheet = workbook.Sheets[targetSheetName];
        // Đọc từ vùng A34:Q90 theo yêu cầu
        const allData = xlsx.utils.sheet_to_json(sheet, { range: 'A34:Q90', header: 1 });
        
        const originalHeaders = allData[0] || [];
        const desiredHeaders = [
            'STT', 'CÔNG VIỆC', 'LÝ TRÌNH', 'ĐƠN VỊ', 
            '% Hoàn thành trong tuần', '% Hoàn thiện theo dự án', 'Ghi chú'
        ];
        
        // Tìm chỉ số (index) của các cột cần giữ lại
        const indicesToKeep = desiredHeaders.map(dh => 
            originalHeaders.findIndex(oh => String(oh).trim() === dh)
        );

        if (indicesToKeep.some(index => index === -1)) {
            throw new Error('Một hoặc nhiều tên cột yêu cầu không được tìm thấy trong file Excel. Vui lòng kiểm tra lại tên cột.');
        }
        
        // Lọc lại dữ liệu của mỗi hàng để chỉ giữ lại các cột tương ứng
        const newRowsAsArrays = allData.slice(1)
            .filter(row => row.length > 0 && row[0] !== null && row[0] !== '')
            .map(row => indicesToKeep.map(index => row[index]));
        
        // Tạo bảng nếu chưa tồn tại
        await sql`
          CREATE TABLE IF NOT EXISTS reports (
            id SERIAL PRIMARY KEY,
            headers_data JSONB,
            report_data JSONB,
            conclusion TEXT,
            recommendation TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `;
        
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