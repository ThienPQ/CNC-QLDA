// pages/api/ai-evaluate.js
import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';

// Khởi tạo client OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cấu hình để Next.js hiểu đây là một API Edge Runtime, tốt hơn cho streaming
export const config = {
  runtime: 'edge',
};

export default async function handler(req, res) {
  try {
    // Nhận dữ liệu từ request, lần này là từ req.json() vì đang ở Edge Runtime
    const { reportData, conclusion, recommendation } = await req.json();

    // Do Edge Runtime không truy cập được file system, chúng ta sẽ không đọc PLHD.xlsx ở đây nữa
    // Thay vào đó, bạn có thể truyền một vài thông tin chính từ PLHD vào prompt nếu cần,
    // hoặc giữ nguyên prompt đơn giản như lần trước.
    // Ở đây, chúng ta sẽ giữ prompt đơn giản để tập trung vào streaming.

    const slowItems = reportData.filter(row => {
        const completionText = row['% Hoàn thành trong tuần'] || '100%';
        const completionValue = parseFloat(completionText);
        return completionValue < 100;
    });

    if (slowItems.length === 0) {
        // Với streaming, chúng ta cần trả về một luồng văn bản tĩnh
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue('Chúc mừng! Không có hạng mục nào bị chậm tiến độ trong tuần này.');
                controller.close();
            },
        });
        return new StreamingTextResponse(stream);
    }
    
    // Xây dựng prompt
    const systemPrompt = `Bạn là một giám đốc dự án xây dựng nhiều kinh nghiệm. Nhiệm vụ của bạn là xem xét các hạng mục đang bị chậm tiến độ và đưa ra các giải pháp xử lý cụ thể, khả thi và chuyên nghiệp.`;
    const userPrompt = `Dưới đây là danh sách các hạng mục công việc đang bị chậm tiến độ và thông tin liên quan. Hãy phân tích và đề xuất giải pháp cho từng hạng mục.\n\n` + 
    slowItems.map((row, index) => `Hạng mục ${index + 1}: ${row['Hạng mục công việc'] || 'Không rõ'}. Kế hoạch: ${row['Kế hoạch tuần trước'] || 'N/A'}. Thực hiện: ${row['Thực hiện'] || 'N/A'}. % Hoàn thành tuần: ${row['% Hoàn thành trong tuần'] || 'N/A'}. Ghi chú: ${row['Ghi chú'] || 'Không có'}`).join('\n\n') +
    `\n\nKết luận chung: ${conclusion || 'Không có'}\nKiến nghị chung: ${recommendation || 'Không có'}`;

    // Gọi API của OpenAI với stream: true
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      stream: true, // Yêu cầu trả về một luồng dữ liệu
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
    });

    // Chuyển luồng từ OpenAI thành một luồng mà Vercel có thể gửi về trình duyệt
    const stream = OpenAIStream(response);
    
    // Trả về một StreamingTextResponse
    return new StreamingTextResponse(stream);

  } catch (error) {
    console.error('Lỗi trong API streaming:', error);
    // Nếu có lỗi, trả về một lỗi 500 dưới dạng stream
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue('Lỗi: Không thể nhận được đánh giá từ OpenAI.');
            controller.close();
        },
    });
    return new StreamingTextResponse(stream, { status: 500 });
  }
}