// pages/api/ai-evaluate.js
import { sql } from '@vercel/postgres';
import OpenAI from 'openai';

export const config = { runtime: 'edge' };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Hàm này parse dữ liệu thô thành các object với đầy đủ các cột
function parseFullReportData(raw_data) {
  if (!raw_data) return [];
  const allData = raw_data; // Dữ liệu từ Vercel Postgres đã là object
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
    const reportsResult = await sql`
      SELECT week_start_date, week_end_date, raw_data FROM reports 
      ORDER BY week_end_date DESC, id DESC LIMIT 2;
    `;

    if (reportsResult.rows.length < 2) {
      return new Response("Cần ít nhất 2 báo cáo tuần trong hệ thống để thực hiện so sánh.", { status: 400 });
    }

    const latestReportData = parseFullReportData(reportsResult.rows[0].raw_data);
    const previousReportData = parseFullReportData(reportsResult.rows[1].raw_data);
    
    const contractResult = await sql`SELECT item_name, design_volume FROM contract_items;`;
    const contractPlan = contractResult.rows;

    // Tạo bản tóm tắt súc tích, sử dụng các cột khối lượng thật
    const comparisonSummary = latestReportData.map(currentItem => {
      const prevItem = previousReportData.find(p => p['CÔNG VIỆC'] === currentItem['CÔNG VIỆC']);
      const contractItem = contractPlan.find(c => c.item_name === currentItem['CÔNG VIỆC']);
      
      const currentWorkDone = currentItem['Thực hiện'] || 0;
      const prevWorkDone = prevItem ? prevItem['Thực hiện'] || 0 : 0;
      const cumulativeProgress = (currentItem['% Hoàn thiện theo dự án'] || 0) * 100;
      
      if (currentWorkDone > 0 || currentItem['Ghi chú']) {
        return `- Công việc: ${currentItem['CÔNG VIỆC']}. Khối lượng tuần này: ${currentWorkDone} (so với ${prevWorkDone} tuần trước). Lũy kế dự án: ${cumulativeProgress.toFixed(1)}%. Ghi chú: ${currentItem['Ghi chú'] || 'Không'}`;
      }
      return null;
    }).filter(Boolean).join('\n');

    if (!comparisonSummary) {
      return new Response("Không có hoạt động đáng kể nào trong tuần này để phân tích.");
    }

    const systemPrompt = `Là một trợ lý quản lý dự án cấp cao, hãy phân tích sâu sắc về tiến độ dự án dựa trên dữ liệu so sánh giữa các tuần và kế hoạch. Hãy đưa ra nhận định sắc bén, chỉ rõ rủi ro và đề xuất giải pháp chiến lược.`;
    const userPrompt = `Dưới đây là tóm tắt tiến độ dự án. Hãy phân tích các điểm sau:\n1. **Hiệu suất (Tuần-với-Tuần):** So sánh khối lượng thực hiện. Hiệu suất đang tăng hay giảm? \n2. **So với hợp đồng:** Mức độ hoàn thành lũy kế có đáp ứng kế hoạch không?\n3. **Rủi ro:** Dựa vào Ghi chú và các hạng mục có hiệu suất giảm, cảnh báo các rủi ro lớn nhất.\n4. **Hành động:** Đề xuất giải pháp cụ thể để thúc đẩy các hạng mục đang chậm.\n\n### DỮ LIỆU SO SÁNH:\n${comparisonSummary}`;

    const responseStream = await openai.chat.completions.create({
      model: "gpt-4-turbo",
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