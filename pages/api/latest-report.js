
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const uploadsDir = path.join(process.cwd(), 'uploads');

  if (!fs.existsSync(uploadsDir)) {
    return res.status(200).json({ file: null });
  }

  const files = fs.readdirSync(uploadsDir)
    .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
    .map(f => ({
      name: f,
      time: fs.statSync(path.join(uploadsDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length === 0) {
    return res.status(200).json({ file: null });
  }

  return res.status(200).json({ file: files[0].name });
}
