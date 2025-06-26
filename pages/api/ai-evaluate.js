// pages/api/ai-evaluate.js (Phiên bản cuối cùng: Chỉ phân tích các hạng mục có Ghi chú)
import { sql } from '@vercel/postgres';
import OpenAI from 'openai';

export const config = { runtime: 'edge' };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Hàm này parse dữ liệu thô thành các object với đầy đủ các cột
function parseFullReportData(raw_data) {
  if (!raw_data) return [];
  const allData = raw_data;
  const headers = allData[0].map(h => String(h || '').trim());
  return allData.slice(1)
    .filter(row => Array.isArray(row) && row.length > 0 && String(row[0] || '').trim() !== '')
    .map(rowArray => {
      const obj = {};
      headers.forEach((header, index) => {
        const key = header || `column_${index}`;
        obj[key] = rowArray[index];
      });
      return obj;
    });
}

export default async function handler(req) {
  try {
    // Tối ưu: Chỉ cần lấy báo cáo mới nhất, không cần so sánh nữa
    const reportResult = await sql`
      SELECT raw_data FROM reports ORDER BY week_end_date DESC, id DESC LIMIT 1;
    `;
    if (reportResult.rows.length === 0) {
      return new Response("Không có dữ liệu báo cáo để phân tích.", { status: 400 });
    }

    const latestReportData = parseFullReportData(reportResult.rows[0].raw_data);

    // --- LOGIC LỌC MỚI: CHỈ LẤY CÁC HẠNG MỤC CÓ GHI CHÚ ---
    const itemsWithNotes = latestReportData.filter(
      item => item['Ghi chú'] && String(item['Ghi chú']).trim() !== ''
    );

    if (itemsWithNotes.length === 0) {
      return new Response("Rất tốt! Không có hạng mục nào có ghi chú cần phân tích trong báo cáo tuần này.");
    }

    // Tạo prompt siêu ngắn gọn, chỉ tập trung vào các hạng mục có ghi chú
    const summary = itemsWithNotes.map(item => 
      `- Công việc: ${item['CÔNG VIỆC']}\n  - Ghi chú: ${item['Ghi chú']}`
    ).join('\n');

    const systemPrompt = `Là một giám đốc dự án nhiều kinh nghiệm, nhiệm vụ của bạn là xem xét các vấn đề được ghi chú lại trong báo cáo tuần và đưa ra các giải pháp xử lý cụ thể, khả thi.`;
    const userPrompt = `
      Dưới đây là danh sách các hạng mục công việc có ghi chú về vấn đề phát sinh. Hãy phân tích các ghi chú này và đề xuất hành động khắc phục cho từng hạng mục.

      ### CÁC HẠNG MỤC CÓ VẤN ĐỀ:
      ${summary}
    `;

    // Gọi AI và trả về kết quả dạng stream
    const responseStream = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Dùng model nhanh và tiết kiệm
      stream: true,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature: 0.5,
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