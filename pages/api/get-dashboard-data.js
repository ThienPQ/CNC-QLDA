import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    const data = await sql`
      WITH LatestReport AS (
        SELECT id FROM weekly_reports ORDER BY end_date DESC, id DESC LIMIT 1
      ),
      AggregatedProgress AS (
        SELECT
          task_id,
          SUM(work_done_this_week) as total_work_done,
          SUM(cumulative_work_done) as total_cumulative_work_done
        FROM progress_entries
        GROUP BY task_id
      ),
      LatestWeekProgress AS (
        SELECT task_id, work_done_this_week
        FROM progress_entries
        WHERE report_id = (SELECT id FROM LatestReport)
      )
      SELECT 
        t1.id,
        (SELECT task_name FROM project_tasks WHERE id = t2.parent_id) as category,
        t2.task_name as sub_category,
        t1.task_name, 
        COALESCE(lwp.work_done_this_week, 0) as work_done_this_week,
        COALESCE(ap.total_work_done, 0) as total_work_done,
        (CASE WHEN t1.contract_volume > 0 THEN COALESCE(ap.total_cumulative_work_done, 0) / t1.contract_volume ELSE 0 END) as completion_percentage
      FROM 
        project_tasks t1
      LEFT JOIN AggregatedProgress ap ON t1.id = ap.task_id
      LEFT JOIN LatestWeekProgress lwp ON t1.id = lwp.task_id
      LEFT JOIN project_tasks t2 ON t1.parent_id = t2.id
      WHERE 
        t1.is_group = FALSE AND (ap.total_work_done > 0 OR lwp.work_done_this_week > 0)
      ORDER BY t1.id;
    `;
    res.status(200).json(data.rows);
  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu dashboard:", error);
    res.status(500).json({ error: 'Không thể lấy dữ liệu dashboard.' });
  }
}