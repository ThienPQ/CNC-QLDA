
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  try {
    const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.xlsx'));
    res.status(200).json({ files });
  } catch (err) {
    console.error('Lỗi đọc thư mục uploads:', err);
    res.status(500).json({ error: 'Không thể đọc thư mục uploads' });
  }
}
