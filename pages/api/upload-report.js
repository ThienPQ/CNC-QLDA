// pages/api/upload-report.js (Phiên bản tạm thời - Chỉ để upload)
import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';

export const config = { api: { bodyParser: false } };

// Cấu hình Cloudinary
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
      if (!file || !desiredFilename) {
        throw new Error('File hoặc loại file không hợp lệ.');
      }

      // Chỉ thực hiện việc tải file lên Cloudinary
      await cloudinary.uploader.upload(file.filepath, {
        resource_type: 'raw',
        public_id: desiredFilename,
        overwrite: true,
      });

      // KHÔNG LÀM GÌ THÊM (KHÔNG ĐỌC FILE, KHÔNG LƯU DB)
      
      res.status(200).json({ message: `Tải file '${desiredFilename}' lên Cloudinary thành công. Giờ bạn có thể vào trang /debug để kiểm tra.` });

    } catch (error) {
      console.error("Lỗi trong quá trình upload:", error);
      res.status(500).json({ error: error.message });
    }
  });
}