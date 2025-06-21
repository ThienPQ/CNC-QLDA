// pages/api/analyze-ai.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { reports } = req.body;
  try {
    const content = reports
      .map((r) => `Tuyến ${r.tuyen}: ${r.danhGia}, tiến độ ${r.tienDo}%, khối lượng ${r.khoiLuong}`)
      .join('\n');

    const gptResponse = `Tổng quan: ${reports.length} tuyến đều đang được thực hiện. Cần tiếp tục theo dõi các tuyến có tiến độ thấp hơn hợp đồng.`;

    res.status(200).json({ result: gptResponse });
  } catch (e) {
    console.error('Lỗi đánh giá AI:', e);
    res.status(500).json({ result: 'Không thể phân tích' });
  }
}
