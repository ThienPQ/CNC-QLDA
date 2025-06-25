import OpenAI from 'openai';
export const config = { runtime: 'edge' };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req) {
  try {
    const { reportData } = await req.json(); // Chỉ nhận reportData
    if (!reportData) throw new Error('Dữ liệu báo cáo không được gửi đi.');

    const itemsToAnalyze = reportData.filter(row => row['% Hoàn thành trong tuần'] || row['Ghi chú']);
    if (itemsToAnalyze.length === 0) {
      return new Response('Không có hạng mục nào đang thi công hoặc có vấn đề để phân tích.');
    }
    
    const systemPrompt = `Là một giám đốc dự án nhiều kinh nghiệm, hãy xem xét các hạng mục công việc dưới đây và đưa ra đánh giá ngắn gọn, tập trung vào rủi ro và đề xuất giải pháp.`;
    const userPrompt = `
      Dưới đây là các hạng mục công việc trong báo cáo tuần.
      ### CÁC HẠNG MỤC CẦN CHÚ Ý:
      ${itemsToAnalyze.map(item => `- Công việc: ${item['CÔNG VIỆC']}, % hoàn thành tuần này: ${item['% Hoàn thành trong tuần'] ? (item['% Hoàn thành trong tuần'] * 100).toFixed(1) + '%' : 'N/A'}, Ghi chú: ${item['Ghi chú'] || 'Không'}`).join('\n')}
      ---
      **YÊU CẦU:**
      Dựa vào thông tin trên, hãy đưa ra các phương án xử lý cho các hạng mục công việc có vẻ đang bị chậm tiến độ hoặc có ghi chú đáng quan ngại.
    `;

    const responseStream = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      stream: true,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const chunk of responseStream) {
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });
    return new Response(stream);
  } catch (error) {
    console.error('Lỗi trong API streaming:', error);
    return new Response(JSON.stringify({ error: 'Không thể nhận được đánh giá từ OpenAI.' }), { status: 500 });
  }
}