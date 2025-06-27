// pages/api/get-dashboard-data.js (Phiên bản cuối cùng, đã sửa lỗi "cumulative_work_done")
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    // Bước 1: Lấy tất cả các công việc chi tiết (không phải nhóm)
    const tasksResult = await sql`
      SELECT 
        id, 
        task_name,
        parent_id,
        contract_volume,
        stt
      FROM 
        project_tasks 
      WHERE 
        is_group = FALSE 
      ORDER BY id;
    `;

    // Nếu không có công việc nào trong kế hoạch, trả về mảng rỗng
    if (tasksResult.rows.length === 0) {
      return res.status(200).json([]);
    }

    // Bước 2: Lấy toàn bộ lịch sử tiến độ (chỉ cần cột work_done_this_week)
    const progressResult = await sql`
      SELECT task_id, report_id, work_done_this_week 
      FROM progress_entries;
    `;
    
    // Bước 3: Lấy ID của báo cáo mới nhất
    const latestReportResult = await sql`
      SELECT id FROM weekly_reports ORDER BY end_date DESC, id DESC LIMIT 1;
    `;
    const latestReportId = latestReportResult.rows.length > 0 ? latestReportResult.rows[0].id : null;

    // Bước 4: Lấy thông tin các nhóm cha để hiển thị
    const groupsResult = await sql`SELECT id, task_name, parent_id FROM project_tasks WHERE is_group = TRUE;`;
    const groupMap = new Map();
    groupsResult.rows.forEach(group => groupMap.set(group.id, group));

    // Bước 5: Kết hợp và tính toán dữ liệu bằng JavaScript (đáng tin cậy hơn)
    const dashboardData = tasksResult.rows.map(task => {
      // Tìm tất cả các bản ghi tiến độ cho công việc này
      const allProgressForThisTask = progressResult.rows.filter(p => p.task_id === task.id);

      // TÍNH TOÁN LẠI LŨY KẾ: Cộng dồn tất cả các tuần lại với nhau
      const totalWorkDone = allProgressForThisTask.reduce((sum, current) => sum + (Number(current.work_done_this_week) || 0), 0);

      // Tìm bản ghi tiến độ của tuần mới nhất
      const latestProgress = latestReportId 
        ? allProgressForThisTask.find(p => p.report_id === latestReportId) 
        : null;
      
      const workDoneThisWeek = latestProgress?.work_done_this_week || 0;
      const completionPercentage = (task.contract_volume > 0) ? (totalWorkDone / task.contract_volume) : 0;
      
      // Tìm tên nhóm cha và ông
      const parentGroup = task.parent_id ? groupMap.get(task.parent_id) : null;
      const grandParentGroup = parentGroup?.parent_id ? groupMap.get(parentGroup.parent_id) : null;

      return {
        id: task.id,
        stt: task.stt,
        category: grandParentGroup?.task_name || '',
        sub_category: parentGroup?.task_name || '',
        task_name: task.task_name,
        work_done_this_week: workDoneThisWeek,
        total_work_done: totalWorkDone,
        completion_percentage: completionPercentage
      };
    });
    
    // Chỉ trả về những công việc đã từng có tiến độ
    const finalData = dashboardData.filter(item => item.total_work_done > 0);

    res.status(200).json(finalData);

  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu dashboard:", error);
    res.status(500).json({ error: 'Không thể lấy dữ liệu tổng hợp cho dashboard. Lỗi: ' + error.message });
  }
}