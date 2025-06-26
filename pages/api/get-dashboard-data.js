// pages/api/get-dashboard-data.js (Phiên bản Debug)
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  console.log("[DEBUG] Bắt đầu yêu cầu tới /api/get-dashboard-data.");
  try {
    // 1. Lấy tất cả các công việc chi tiết
    console.log("[DEBUG] Đang truy vấn danh sách công việc (tasks)...");
    const tasksResult = await sql`
      SELECT 
        t1.id, t1.task_name, t1.design_volume, t1.unit,
        t2.task_name as parent_name,
        t3.task_name as grandparent_name
      FROM 
        project_tasks t1
      LEFT JOIN project_tasks t2 ON t1.parent_task_id = t2.id
      LEFT JOIN project_tasks t3 ON t2.parent_task_id = t3.id
      WHERE t1.is_group = FALSE;
    `;
    console.log(`[DEBUG] Truy vấn công việc thành công. Tìm thấy ${tasksResult.rows.length} công việc.`);
    if (tasksResult.rows.length === 0) {
        return res.status(200).json([]); // Trả về mảng rỗng nếu chưa có công việc nào
    }

    // 2. Lấy toàn bộ dữ liệu tiến độ
    console.log("[DEBUG] Đang truy vấn toàn bộ lịch sử tiến độ (progress)...");
    const progressResult = await sql`
      SELECT task_id, work_done_this_week 
      FROM progress_entries;
    `;
    console.log(`[DEBUG] Truy vấn tiến độ thành công. Tìm thấy ${progressResult.rows.length} bản ghi tiến độ.`);

    // 3. Xử lý và tổng hợp dữ liệu
    console.log("[DEBUG] Bắt đầu tổng hợp dữ liệu...");
    const dashboardData = tasksResult.rows.map(task => {
      const totalWorkDone = progressResult.rows
        .filter(p => p.task_id === task.id)
        .reduce((sum, current) => sum + (Number(current.work_done_this_week) || 0), 0);
      
      const completionPercentage = (task.design_volume > 0) ? (totalWorkDone / task.design_volume) : 0;
      
      const latestProgress = progressResult.rows
        .filter(p => p.task_id === task.id)
        .pop() || { work_done_this_week: 0 };

      return {
        full_task_name: `${task.grandparent_name || ''} > ${task.parent_name || ''} > ${task.task_name}`,
        work_done_this_week: latestProgress.work_done_this_week,
        total_work_done: totalWorkDone,
        completion_percentage: completionPercentage
      };
    });
    console.log("[DEBUG] Tổng hợp dữ liệu thành công. Chuẩn bị gửi về client.");

    res.status(200).json(dashboardData);

  } catch (error) {
    console.error("[LỖI NGHIÊM TRỌNG] Lỗi khi lấy dữ liệu dashboard:", error);
    res.status(500).json({ error: `Không thể lấy dữ liệu tổng hợp cho dashboard. Lỗi: ${error.message}` });
  }
}