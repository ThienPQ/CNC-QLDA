import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

  const form = formidable({ multiples: false, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Lỗi khi phân tích form:", err);
      return res.status(500).json({ message: "Lỗi phân tích dữ liệu." });
    }

    const file = files.report;
    if (!file || !file.filepath) {
      return res.status(400).json({ message: "Không tìm thấy file để lưu." });
    }

    const fromDate = fields.fromDate?.toString() || '';
    const toDate = fields.toDate?.toString() || '';
    const newFileName = `BC_${fromDate}_den_${toDate}.xlsx`;
    const destPath = path.join(uploadsDir, newFileName);

    try {
      await fs.promises.copyFile(file.filepath, destPath);
      return res.status(200).json({ message: `Tải lên thành công: ${newFileName}` });
    } catch (copyErr) {
      console.error("Lỗi khi lưu file:", copyErr);
      return res.status(500).json({ message: "Lỗi khi lưu file." });
    }
  });
}
