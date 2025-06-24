// pages/api/ai-evaluate.js (Phiên bản chuẩn cho OpenAI)
import OpenAI from 'openai';

// Khởi tạo client OpenAI với key từ .env.local
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function formatSlowItemsForPrompt(data) {
    let formattedString = '';
    if (!data || data.length === 0) {
        return 'Không có hạng mục nào bị chậm trong tuần này.\n';
    }
    
    data.forEach((row, index) => {
        formattedString += `--- Hạng mục chậm ${index + 1} ---\n`;
        formattedString += `Tên công việc: ${row['Hạng mục công việc'] || 'Không rõ'}\n`;
        formattedString += `Kế hoạch tuần: ${row['Kế hoạch tuần trước'] || 'N/A'}\n`;
        formattedString += `Thực hiện tuần: ${row['Thực hiện'] || 'N/A'}\n`;
        formattedString += `% Hoàn thành trong tuần: ${row['% Hoàn thành trong tuần'] || 'N/A'}\n`;
        formattedString += `Ghi chú: ${row['Ghi chú'] || 'Không có'}\n\n`;
    });

    return formattedString;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Phương thức không được hỗ trợ' });
  }

  try {
    const weeklyReport = req.body;
    if (!weeklyReport || !weeklyReport.reportData) {
        return res.status(400).json({ error: 'Dữ liệu báo cáo không được gửi đi trong yêu cầu.' });
    }

    const slowItems = weeklyReport.reportData.filter(row => {
        const completionText = row['% Hoàn thành trong tuần'] || '100%';
        const completionValue = parseFloat(completionText);
        return completionValue < 100;
    });

    if (slowItems.length === 0) {
        return res.status(200).json({ result: 'Chúc mừng! Không có hạng mục nào bị chậm tiến độ trong tuần này.' });
    }

    const systemPrompt = `Bạn là một giám đốc dự án xây dựng nhiều kinh nghiệm. Nhiệm vụ của bạn là xem xét các hạng mục đang bị chậm tiến độ và đưa ra các giải pháp xử lý cụ thể, khả thi và chuyên nghiệp.`;
    
    const userPrompt = `
      Dưới đây là danh sách các hạng mục công việc đang bị chậm tiến độ trong tuần vừa qua, cùng với kết luận và kiến nghị chung của người làm báo cáo.

      ### CÁC HẠNG MỤC CHẬM TIẾN ĐỘ:
      ${formatSlowItemsForPrompt(slowItems)}

      ### KẾT LUẬN CHUNG TỪ BÁO CÁO:
      ${weeklyReport.conclusion || 'Không có'}

      ### KIẾN NGHỊ CHUNG TỪ BÁO CÁO:
      ${weeklyReport.recommendation || 'Không có'}

      ---
      **YÊU CẦU:**
      Đối với từng hạng mục bị chậm, hãy phân tích nhanh nguyên nhân có thể (dựa vào số liệu và ghi chú) và đề xuất 1-2 hành động cụ thể, ưu tiên để khắc phục tình hình. Trình bày câu trả lời rõ ràng theo từng hạng mục.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
    });

    const resultText = completion.choices[0].message.content;
    res.status(200).json({ result: resultText });

  } catch (error) {
    console.error('Lỗi từ API của OpenAI:', error);
    res.status(500).json({ error: 'Không thể nhận được đánh giá từ OpenAI.', details: error.message });
  }
}