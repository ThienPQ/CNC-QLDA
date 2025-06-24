// pages/api/evaluate-ai.js
import path from 'path';
import xlsx from 'xlsx';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function formatDataForPrompt(title, data) {
    let formattedString = `### ${title}\n`;
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]);
      formattedString += `| ${headers.join(' | ')} |\n`;
      formattedString += `| ${headers.map(() => '---').join(' | ')} |\n`;
      data.forEach(row => {
        formattedString += `| ${headers.map(header => row[header]).join(' | ')} |\n`;
      });
    } else if (typeof data === 'string' && data) {
      formattedString += `${data}\n`;
    } else {
      formattedString += 'Không có dữ liệu.\n';
    }
    return formattedString;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Phương thức không được hỗ trợ' });
  }

  try {
    // >>> PHẦN QUAN TRỌNG: Nhận dữ liệu từ req.body do frontend gửi lên
    const weeklyReport = req.body; 
    // <<< KẾT THÚC PHẦN QUAN TRỌNG

    if (!weeklyReport || !weeklyReport.reportData) {
        return res.status(400).json({ error: 'Dữ liệu báo cáo không được gửi đi trong yêu cầu.' });
    }
    
    const plhdPath = path.join(process.cwd(), 'public', 'PLHD.xlsx');
    let contractPlanData = [];
    try {
      const workbook = xlsx.readFile(plhdPath);
      const sheetName = workbook.SheetNames[0];
      contractPlanData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } catch (e) {
      console.error("Không thể đọc file PLHD.xlsx: ", e);
      return res.status(500).json({ error: 'Không tìm thấy hoặc lỗi file PLHD.xlsx trong thư mục /public.' });
    }

    const prompt = `
      Là một trợ lý quản lý dự án chuyên nghiệp, hãy phân tích và đánh giá tiến độ dự án dựa trên các thông tin sau:

      **A. KẾ HOẠCH THEO HỢP ĐỒNG (Trích xuất từ file PLHD.xlsx):**
      ${formatDataForPrompt('Bảng khối lượng và tiến độ theo hợp đồng', contractPlanData)}

      **B. BÁO CÁO THỰC TẾ TRONG TUẦN (Trích xuất từ file bao cao tuan.xlsx):**
      ${formatDataForPrompt('Bảng thực hiện chi tiết', weeklyReport.reportData)}

      **Ghi chú trong tuần:**
      ${weeklyReport.reportData.map(r => r['Ghi chú']).filter(g => g).join(', ') || 'Không có'}

      **Kết luận của người báo cáo:**
      ${weeklyReport.conclusion || 'Không có'}

      **Kiến nghị của người báo cáo:**
      ${weeklyReport.recommendation || 'Không có'}

      ---
      **YÊU CẦU PHÂN TÍCH:**
      Dựa vào sự so sánh giữa Kế hoạch (Phần A) và Thực tế (Phần B), hãy đưa ra một bản đánh giá chi tiết và chuyên sâu, bao gồm các mục sau:
      1. Đánh giá tiến độ và khối lượng.
      2. Phân tích rủi ro.
      3. Đề xuất giải pháp.
      Trình bày kết quả một cách có cấu trúc, chuyên nghiệp, sử dụng markdown.
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();

    res.status(200).json({ result: text });

  } catch (error) {
    console.error('Lỗi khi gọi API đánh giá AI:', error);
    res.status(500).json({ error: 'Không thể nhận được đánh giá từ AI.', details: error.message });
  }
}