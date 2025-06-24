
import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';

export const config = {
  api: {
    bodyParser: true,
  },
};

// Khởi tạo OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const jsonPath = path.join(process.cwd(), 'public', 'plhd_hang_muc.json');

    const { filename } = req.body;
    const reportPath = path.join(uploadsDir, filename);

    if (!fs.existsSync(reportPath) || !fs.existsSync(jsonPath)) {
      return res.status(404).json({ message: 'Không tìm thấy file dữ liệu' });
    }

    // Đọc báo cáo tuần mới nhất
    const xlsx = await import('xlsx');
    const reportWorkbook = xlsx.readFile(reportPath);
    const reportData = xlsx.utils.sheet_to_json(reportWorkbook.Sheets[reportWorkbook.SheetNames[0]], { defval: '' });

    // Đọc danh sách hạng mục từ file JSON
    const contractData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Tạo prompt cho ChatGPT
    const prompt = `
Bạn là chuyên gia giám sát xây dựng. Dưới đây là thông tin:
1. Danh sách hạng mục trong hợp đồng: ${JSON.stringify(contractData.slice(0, 30))}
2. Dữ liệu báo cáo tuần: ${JSON.stringify(reportData.slice(0, 30))}

Hãy so sánh khối lượng, tiến độ, ghi chú, thiết bị, nhân lực giữa báo cáo và hợp đồng. Đưa ra đánh giá theo từng hạng mục (nếu có), và kết luận chung về tiến độ. Viết bằng tiếng Việt, ngắn gọn và rõ ràng.
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const result = completion.choices[0].message.content;

    return res.status(200).json({ result });

  } catch (err) {
    console.error('Lỗi phân tích AI:', err);
    return res.status(500).json({ message: 'Lỗi phân tích AI' });
  }
}
