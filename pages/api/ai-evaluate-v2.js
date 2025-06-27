import { sql } from '@vercel/postgres';
import OpenAI from 'openai';
export const config = { runtime: 'edge' };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req) {
  try {
    const [reportsResult, tasksResult, progressResult] = await Promise.all([
      sql`SELECT id FROM weekly_reports ORDER BY end_date DESC LIMIT 2;`,
      sql`SELECT id, task_name FROM project_tasks WHERE is_group = FALSE;`,
      sql`SELECT task_id, report_id, work_done_this_week, notes FROM progress_entries;`
    ]);

    if (reportsResult.rows.length < 2) return new Response("Cần ít nhất 2 báo cáo tuần để so sánh.");

    const latestReportId = reportsResult.rows[0].id;
    const previousReportId = reportsResult.rows[1].id;
    const tasks = tasksResult.rows;

    const summary = tasks.map(task => {
      const latestProgress = progressResult.rows.find(p => p.task_id === task.id && p.report_id === latestReportId);
      const prevProgress = progressResult.rows.find(p => p.task_id === task.id && p.report_id === previousReportId);
      const workDoneThisWeek = Number(latestProgress?.work_done_this_week || 0);
      if (workDoneThisWeek > 0 || latestProgress?.notes) {
        return `- Công việc: ${task.task_name}. KL tuần này: ${workDoneThisWeek.toFixed(1)} (so với ${Number(prevProgress?.work_done_this_week || 0).toFixed(1)} tuần trước). Ghi chú: ${latestProgress?.notes || 'Không'}`;
      }
      return null;
    }).filter(Boolean).join('\n');

    if (!summary) return new Response("Không có hoạt động đáng kể nào trong tuần mới nhất để phân tích.");

    const systemPrompt = `Là một trợ lý quản lý dự án cấp cao, phân tích sâu sắc về tiến độ dự án dựa trên khối lượng thực tế.`;
    const userPrompt = `Dựa vào dữ liệu so sánh khối lượng thực hiện giữa các tuần, hãy đưa ra một bản đánh giá chi tiết:\n1. **Hiệu suất:** So sánh khối lượng "Thực hiện" tuần này và tuần trước. Hiệu suất chung tăng hay giảm?\n2. **Rủi ro và Dự báo:** Các hạng mục nào có rủi ro chậm tiến độ dựa trên khối lượng thực hiện và ghi chú?\n3. **Đề xuất hành động:** Đưa ra giải pháp cụ thể dựa trên số liệu thực tế.\n\n### DỮ LIỆU TÓM TẮT:\n${summary}`;

    const responseStream = await openai.chat.completions.create({
      model: "gpt-4-turbo", stream: true,
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
    console.error('Lỗi API AI v2:', error);
    return new Response(JSON.stringify({ error: 'Không thể nhận được phân tích chuyên sâu.' }), { status: 500 });
  }
}