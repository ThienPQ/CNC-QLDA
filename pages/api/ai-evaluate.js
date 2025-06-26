// pages/api/ai-evaluate.js (Phiên bản siêu tinh gọn để chống timeout)
import { sql } from '@vercel/postgres';
import OpenAI from 'openai';

export const config = { runtime: 'edge' };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Hàm parse dữ liệu, chỉ lấy các cột cần thiết nhất
function parseEssentialData(raw_data) {
  if (!raw_data) return [];
  const allData = raw_data;
  const headers = allData[0].map(h => String(h || '').trim());
  const requiredCols = ['CÔNG VIỆC', '% Hoàn thành trong tuần', 'Ghi chú'];
  const indices = requiredCols.map(rc => headers.findIndex(h => h.toUpperCase() === rc.toUpperCase()));
  
  // Nếu thiếu cột quan trọng, trả về mảng rỗng
  if (indices.some(i => i === -1)) return [];

  return allData.slice(1)
    .filter(row => Array.isArray(row) && row.length > 0 && String(row[0] || '').trim() !== '')
    .map(rowArray => ({
      'Công việc': rowArray[indices[0]],
      '% Tuần': rowArray[indices[1]],
      'Ghi chú': rowArray[indices[2]],
    }));
}

export default async function handler(req) {
  try {
    // Chỉ lấy 2 báo cáo gần nhất, không lấy kế hoạch HĐ để giảm thời gian truy vấn
    const reportsResult = await sql`
      SELECT raw_data FROM reports ORDER BY week_end_date DESC, id DESC LIMIT 2;
    `;
    if (reportsResult.rows.length < 2) {
      return new Response("Cần ít nhất 2 báo cáo tuần để so sánh.", { status: 400 });
    }

    const latestReport = parseEssentialData(reportsResult.rows[0].raw_data);
    const previousReport = parseEssentialData(reportsResult.rows[1].raw_data);

    // Tạo prompt siêu ngắn gọn
    const summary = latestReport.map(currentItem => {
      const prevItem = previousReport.find(p => p['Công việc'] === currentItem['Công việc']);
      const currentProgress = (currentItem['% Tuần'] || 0) * 100;
      if (currentProgress > 0 || currentItem['Ghi chú']) {
        return `- ${currentItem['Công việc']}: Tuần này ${currentProgress.toFixed(0)}%. Ghi chú: ${currentItem['Ghi chú'] || 'Không'}`;
      }
      return null;
    }).filter(Boolean).join('\n');

    if (!summary) {
      return new Response("Không có hoạt động đáng kể nào để phân tích.");
    }

    const userPrompt = `Phân tích ngắn gọn tiến độ dự án và đề xuất giải pháp cho các hạng mục sau:\n${summary}`;

    const responseStream = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Dùng model nhanh nhất
      stream: true,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.5, // Giảm độ "sáng tạo" để AI trả lời nhanh hơn
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
    console.error('Lỗi trong API AI:', error);
    return new Response(JSON.stringify({ error: 'Không thể nhận được phân tích từ AI.' }), { status: 500 });
  }
}