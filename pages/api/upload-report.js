// pages/api/upload-report.js
import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';

export const config = {
  api: {
    bodyParser: false,
  },
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({});

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'Lỗi khi parse form data.' });
    }

    try {
      const file = files.file?.[0];
      // Lấy tên file mong muốn từ lựa chọn của người dùng ở frontend
      const desiredFilename = fields.filename?.[0]; 

      if (!file) {
        return res.status(400).json({ error: 'Không tìm thấy file để tải lên.' });
      }

      // Kiểm tra xem tên file có hợp lệ không để bảo mật
      if (!['bao-cao-tuan.xlsx', 'PLHD.xlsx'].includes(desiredFilename)) {
        return res.status(400).json({ error: 'Loại file không hợp lệ.' });
      }
      
      // Tải file lên Cloudinary với tên public_id được gửi từ frontend
      const result = await cloudinary.uploader.upload(file.filepath, {
        resource_type: 'raw',
        public_id: desiredFilename,
        overwrite: true,
      });
      
      res.status(200).json({ 
          message: `Tải lên thành công file: ${desiredFilename}` 
      });

    } catch (uploadErr) {
      console.error("Cloudinary Upload Error:", uploadErr);
      res.status(500).json({ error: 'Lỗi khi tải file lên Cloudinary.' });
    }
  });
}