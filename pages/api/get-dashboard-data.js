// pages/api/get-dashboard-data.js (Phiên bản Debug)
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  console.log("--- [API START] --- Bắt đầu yêu cầu tới /api/get-dashboard-data.");
  try {
    // BƯỚC 1: Lấy tất cả các công việc từ project_tasks
    console.log("BƯỚC 1: Đang truy vấn project_tasks...");
    const tasksResult = await sql`
      SELECT 
        id, 
        task_name, 
        parent_id, 
        contract_volume, 
        unit, 
        is_group 
      FROM project_tasks;
    `;
    console.log(`BƯỚC 1 THÀNH CÔNG: Tìm thấy ${tasksResult.rows.length} công việc/nhóm.`);
    if (tasksResult.rows.length === 0) {
      console.log("Không có công việc nào trong DB, trả về mảng rỗng.");
      return res.status(200).json([]);
    }

    // BƯỚC 2: Lấy tất cả các bản ghi tiến độ
    console.log("BƯỚC 2: Đang truy vấn progress_entries...");
    const progressResult = await sql`
      SELECT task_id, report_id, work_done_this_week 
      FROM progress_entries;
    `;
    console.log(`BƯỚC 2 THÀNH CÔNG: Tìm thấy ${progressResult.rows.length} bản ghi tiến độ.`);

    // BƯỚC 3: Lấy báo cáo mới nhất để xác định KL tuần này
    console.log("BƯỚC 3: Đang truy vấn báo cáo mới nhất...");
    const latestReportResult = await sql`
      SELECT id FROM weekly_reports ORDER BY end_date DESC, id DESC LIMIT 1;
    `;
    const latestReportId = latestReportResult.rows.length > 0 ? latestReportResult.rows[0].id : null;
    console.log(`BƯỚC 3 THÀNH CÔNG: ID của báo cáo mới nhất là ${latestReportId}.`);

    // BƯỚC 4: Xử lý và kết hợp dữ liệu bằng JavaScript
    console.log("BƯỚC 4: Bắt đầu xử lý và kết hợp dữ liệu...");
    
    const taskMap = new Map();
    tasksResult.rows.forEach(task => taskMap.set(task.id, task));

    const detailedTasks = tasksResult.rows.filter(task => !task.is_group);

    const dashboardData = detailedTasks.map(task => {
      const parentTask = task.parent_id ? taskMap.get(task.parent_id) : null;
      const grandParentTask = parentTask?.parent_id ? taskMap.get(parentTask.parent_id) : null;

      const allProgressForThisTask = progressResult.rows.filter(p => p.task_id === task.id);
      
      const totalWorkDone = allProgressForThisTask.reduce((sum, current) => sum + (Number(current.work_done_this_week) || 0), 0);
      
      const completionPercentage = (task.contract_volume > 0) ? (totalWorkDone / task.contract_volume) : 0;

      const latestProgress = latestReportId 
        ? allProgressForThisTask.find(p => p.report_id === latestReportId) 
        : null;

      return {
        full_task_name: `${grandParentTask?.task_name || ''} > ${parentTask?.task_name || ''} > ${task.task_name}`,
        work_done_this_week: latestProgress?.work_done_this_week || 0,
        total_work_done: totalWorkDone,
        completion_percentage: completionPercentage
      };
    });
    console.log("BƯỚC 4 THÀNH CÔNG: Đã tổng hợp xong dữ liệu.");

    // BƯỚC 5: Gửi dữ liệu về client
    console.log("--- [API END] --- Gửi dữ liệu thành công.");
    res.status(200).json(dashboardData);

  } catch (error) {
    console.error("[LỖI NGHIÊM TRỌNG] Lỗi khi lấy dữ liệu dashboard:", error);
    res.status(500).json({ error: `Không thể lấy dữ liệu tổng hợp cho dashboard. Lỗi: ${error.message}` });
  }
}