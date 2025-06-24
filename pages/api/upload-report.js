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
      // Frontend đang gửi file với tên trường là "file"
      const file = files.file[0];
      
      if (!file) {
        return res.status(400).json({ error: 'Không tìm thấy file để tải lên.' });
      }
      
      // Chúng ta sẽ luôn lưu file với một tên cố định để trang xem báo cáo có thể tìm thấy
      const publicFilename = 'bao-cao-tuan.xlsx';
      
      const result = await cloudinary.uploader.upload(file.filepath, {
        resource_type: 'raw',
        public_id: publicFilename,
        overwrite: true,
      });

      // Lấy thông tin ngày tháng từ form để hiển thị trong thông báo
      const fromDate = fields.fromDate?.[0] || 'N/A';
      const toDate = fields.toDate?.[0] || 'N/A';
      
      res.status(200).json({ 
          message: `Tải lên thành công báo cáo cho tuần từ ${fromDate} đến ${toDate}.` 
      });

    } catch (uploadErr) {
      console.error("Cloudinary Upload Error:", uploadErr);
      res.status(500).json({ error: 'Lỗi khi tải file lên Cloudinary.' });
    }
  });
}