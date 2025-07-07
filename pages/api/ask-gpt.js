// pages/api/ask-gpt.js
import { OpenAIApi, Configuration } from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { prompt } = req.body;
  const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));
  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500,
    });
    res.status(200).json({ answer: completion.data.choices[0].message.content });
  } catch (e) {
    res.status(500).json({ error: "AI trả lời lỗi!" });
  }
}
