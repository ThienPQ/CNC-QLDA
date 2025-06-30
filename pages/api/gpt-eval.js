// pages/api/gpt-eval.js
export default async function handler(req, res) {
  const { prompt } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ result: "Chưa cấu hình OPENAI_API_KEY" });

  const payload = {
    model: "gpt-3.5", // hoặc gpt-4-turbo
    messages: [
      { role: "system", content: "Bạn là một chuyên gia quản lý tiến độ dự án giao thông, đánh giá sát thực tế, cụ thể, ngắn gọn." },
      { role: "user", content: prompt }
    ],
    max_tokens: 500,
    temperature: 0.2,
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const json = await r.json();
  res.status(200).json({ result: json.choices?.[0]?.message?.content || "" });
}
