// pages/api/get-dashboard-data.js
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    // Lấy tất cả các công việc chi tiết (không phải nhóm) và thông tin cha của chúng
    const tasksResult = await sql`
      SELECT 
        t1.id, 
        t1.task_name, 
        t1.design_volume,
        t1.unit,
        t2.task_name as parent_name,
        t3.task_name as grandparent_name
      FROM 
        project_tasks t1
      LEFT JOIN 
        project_tasks t2 ON t1.parent_task_id = t2.id
      LEFT JOIN
        project_tasks t3 ON t2.parent_task_id = t3.id
      WHERE 
        t1.is_group = FALSE;
    `;

    // Lấy toàn bộ dữ liệu tiến độ
    const progressResult = await sql`
      SELECT task_id, work_done_this_week 
      FROM progress_entries;
    `;
    
    // Xử lý dữ liệu để tổng hợp
    const dashboardData = tasksResult.rows.map(task => {
      // Tính tổng khối lượng đã hoàn thành cho mỗi công việc
      const totalWorkDone = progressResult.rows
        .filter(p => p.task_id === task.id)
        .reduce((sum, current) => sum + (Number(current.work_done_this_week) || 0), 0);
      
      // Tính tỷ lệ hoàn thành so với hợp đồng
      const completionPercentage = (task.design_volume > 0) 
        ? (totalWorkDone / task.design_volume) 
        : 0;

      // Lấy báo cáo của tuần gần nhất
      const latestProgress = progressResult.rows
        .filter(p => p.task_id === task.id)
        .pop() || { work_done_this_week: 0 }; // Lấy entry cuối cùng

      return {
        // Tên công việc được ghép từ 3 cấp
        full_task_name: `${task.grandparent_name || ''} > ${task.parent_name || ''} > ${task.task_name}`,
        work_done_this_week: latestProgress.work_done_this_week,
        total_work_done: totalWorkDone,
        completion_percentage: completionPercentage
      };
    });

    res.status(200).json(dashboardData);

  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu dashboard:", error);
    res.status(500).json({ error: 'Không thể lấy dữ liệu tổng hợp cho dashboard.' });
  }
}