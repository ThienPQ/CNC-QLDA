// pages/api/ai-evaluate.js
import { sql } from '@vercel/postgres';
import OpenAI from 'openai';

export const config = { runtime: 'edge' };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Hàm này dùng để chuyển dữ liệu thô từ DB thành danh sách các đối tượng
function parseReportData(raw_data) {
  if (!raw_data) return [];
  const allData = JSON.parse(raw_data);
  const headers = allData[0].map(h => String(h || '').trim());
  return allData.slice(1)
    .filter(row => row.length > 0 && String(row[0] || '').trim() !== '')
    .map(rowArray => {
      const obj = {};
      headers.forEach((header, index) => { obj[header] = rowArray[index]; });
      return obj;
    });
}

export default async function handler(req) {
  try {
    // 1. Lấy 2 báo cáo gần nhất từ DB
    const reportsResult = await sql`
      SELECT week_start_date, week_end_date, raw_data FROM reports 
      ORDER BY week_end_date DESC, id DESC LIMIT 2;
    `;

    // 2. Kiểm tra xem có đủ dữ liệu để so sánh không
    if (reportsResult.rows.length < 2) {
      return new Response("Cần ít nhất 2 báo cáo tuần trong hệ thống để thực hiện so sánh.", { status: 400 });
    }

    // Phân tích dữ liệu của tuần này và tuần trước
    const latestReportData = parseReportData(reportsResult.rows[0].raw_data);
    const previousReportData = parseReportData(reportsResult.rows[1].raw_data);
    
    // 3. Lấy dữ liệu kế hoạch hợp đồng từ DB
    const contractResult = await sql`SELECT item_name, design_volume FROM contract_items;`;
    const contractPlan = contractResult.rows;

    // 4. Tạo một bản tóm tắt súc tích để gửi cho AI, giảm token
    const comparisonSummary = latestReportData.map(currentItem => {
      const prevItem = previousReportData.find(p => p['CÔNG VIỆC'] === currentItem['CÔNG VIỆC']);
      const contractItem = contractPlan.find(c => c.item_name === currentItem['CÔNG VIỆC']);
      
      const currentWeekProgress = (currentItem['% Hoàn thành trong tuần'] || 0) * 100;
      const prevWeekProgress = prevItem ? (prevItem['% Hoàn thành trong tuần'] || 0) * 100 : 0;
      const cumulativeProgress = (currentItem['% Hoàn thiện theo dự án'] || 0) * 100;
      const contractVolume = contractItem ? contractItem.design_volume : 'N/A';

      // Chỉ đưa vào prompt những hạng mục có hoạt động hoặc có thay đổi đáng kể
      if (currentWeekProgress > 0 || cumulativeProgress > (prevItem ? (prevItem['% Hoàn thiện theo dự án'] || 0) * 100 : 0)) {
        return `- Công việc: ${currentItem['CÔNG VIỆC']}. Tuần này: ${currentWeekProgress.toFixed(1)}%. Tuần trước: ${prevWeekProgress.toFixed(1)}%. Lũy kế dự án: ${cumulativeProgress.toFixed(1)}%. Ghi chú: ${currentItem['Ghi chú'] || 'Không'}`;
      }
      return null;
    }).filter(Boolean).join('\n');

    if (!comparisonSummary) {
      return new Response("Không có hoạt động đáng kể nào trong tuần này để phân tích.");
    }

    // 5. Xây dựng Prompt cho AI
    const systemPrompt = `Là một trợ lý quản lý dự án cấp cao, hãy phân tích sâu sắc về tiến độ dự án dựa trên dữ liệu so sánh giữa các tuần. Hãy đưa ra nhận định sắc bén, chỉ rõ rủi ro và đề xuất giải pháp chiến lược.`;
    const userPrompt = `
      Dưới đây là tóm tắt tiến độ dự án. Hãy phân tích các điểm sau:
      1.  **Hiệu suất:** So sánh tiến độ tuần này và tuần trước. Hiệu suất đang tăng hay giảm?
      2.  **So với hợp đồng:** Mức độ hoàn thành lũy kế của các hạng mục có đang đi đúng hướng không?
      3.  **Rủi ro:** Dựa vào Ghi chú và các hạng mục có hiệu suất giảm, cảnh báo các rủi ro lớn nhất.
      4.  **Hành động:** Đề xuất giải pháp cụ thể để thúc đẩy các hạng mục đang chậm.

      ### DỮ LIỆU SO SÁNH:
      ${comparisonSummary}
    `;

    // 6. Gọi AI và trả về kết quả dạng stream
    const responseStream = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Dùng model tiết kiệm chi phí
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
    console.error('Lỗi trong API AI chuyên sâu:', error);
    return new Response(JSON.stringify({ error: 'Không thể nhận được phân tích chuyên sâu từ AI.' }), { status: 500 });
  }
}