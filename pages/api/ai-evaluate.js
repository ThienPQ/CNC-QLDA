// pages/api/ai-evaluate.js (Phiên bản Streaming cuối cùng)
import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';

// Khởi tạo client OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cấu hình để Next.js hiểu đây là một API Edge Runtime, tối ưu cho streaming
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const { reportData, conclusion, recommendation } = await req.json();

    if (!reportData) {
      throw new Error('Dữ liệu báo cáo không được gửi đi trong yêu cầu.');
    }

    const slowItems = reportData.filter(row => {
        const completionText = row['% Hoàn thành trong tuần'] || '100%';
        const completionValue = parseFloat(completionText);
        return completionValue < 100;
    });

    if (slowItems.length === 0) {
      // Trả về một luồng văn bản tĩnh nếu không có mục nào bị chậm
      const stream = new ReadableStream({
          start(controller) {
              controller.enqueue('Chúc mừng! Không có hạng mục nào bị chậm tiến độ trong tuần này.');
              controller.close();
          },
      });
      return new StreamingTextResponse(stream);
    }
    
    const systemPrompt = `Bạn là một giám đốc dự án xây dựng nhiều kinh nghiệm. Nhiệm vụ của bạn là xem xét các hạng mục đang bị chậm tiến độ và đưa ra các giải pháp xử lý cụ thể, khả thi và chuyên nghiệp.`;
    
    const userPrompt = `
      Dưới đây là danh sách các hạng mục công việc đang bị chậm tiến độ. Hãy phân tích và đề xuất giải pháp cho từng hạng mục.\n\n` + 
    slowItems.map((row, index) => `Hạng mục ${index + 1}: ${row['Hạng mục công việc'] || 'Không rõ'}. Kế hoạch tuần: ${row['Kế hoạch tuần trước'] || 'N/A'}. Thực hiện tuần: ${row['Thực hiện'] || 'N/A'}. % Hoàn thành tuần: ${row['% Hoàn thành trong tuần'] || 'N/A'}. Ghi chú: ${row['Ghi chú'] || 'Không có'}`).join('\n\n') +
    `\n\nKết luận chung từ báo cáo: ${conclusion || 'Không có'}\nKiến nghị chung từ báo cáo: ${recommendation || 'Không có'}`;

    // Gọi API của OpenAI với stream: true
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
    });

    const stream = OpenAIStream(response);
    return new StreamingTextResponse(stream);

  } catch (error) {
    console.error('Lỗi trong API streaming:', error);
    // Trả về lỗi dưới dạng một luồng có thể đọc được
    return new Response(JSON.stringify({ error: 'Không thể nhận được đánh giá từ OpenAI.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}