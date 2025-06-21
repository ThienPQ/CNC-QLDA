// pages/api/ai-evaluate.js
import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { reports } = req.body;

  if (!reports || !Array.isArray(reports)) {
    return res.status(400).json({ message: 'Invalid data' });
  }

  const prompt = `Bạn là một chuyên gia quản lý dự án xây dựng. Hãy đánh giá tiến độ thi công của từng tuyến dưới đây, so sánh tiến độ thực tế và tiến độ hợp đồng, xem xét ghi chú để phân tích nguyên nhân nhanh, chậm hay đúng tiến độ. Đưa ra hướng xử lý cụ thể cho từng tuyến. Cuối cùng, tổng kết tình hình chung và đề xuất hướng chỉ đạo tổng thể.

${reports.map(r => `
- Tuyến ${r.tuyen}:
  - Tiến độ thực tế: ${r.tienDo}%
  - Tiến độ hợp đồng: ${r.tienDoHopDong}%
  - Đánh giá: ${r.danhGia}
  - Ghi chú: ${r.ghiChu}`).join('\n')}

Trình bày rõ ràng, ngắn gọn, dễ hiểu, chia theo từng tuyến và phần tổng kết.`

  try {
    const aiRes = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const result = aiRes.data.choices[0].message.content;
    res.status(200).json({ result });
  } catch (error) {
    console.error('Lỗi đánh giá AI:', error);
    res.status(500).json({ message: 'Đánh giá AI thất bại' });
  }
}
