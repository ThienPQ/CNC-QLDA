// pages/api/get-dashboard-data.js
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    const tasks = await sql`
      SELECT id, stt, task_name, contract_volume, unit, parent_id
      FROM project_tasks
      WHERE is_group = FALSE
      ORDER BY id;
    `;

    const progresses = await sql`
      SELECT task_id, work_done_this_week, report_id FROM progress_entries;
    `;

    const reports = await sql`
      SELECT id, end_date FROM weekly_reports ORDER BY end_date DESC;
    `;

    const groups = await sql`
      SELECT id, task_name, parent_id FROM project_tasks WHERE is_group = TRUE;
    `;

    const groupMap = new Map();
    groups.rows.forEach(row => groupMap.set(row.id, row));

    // Map báo cáo mới nhất theo task để lấy ghi chú
    const notes = await sql`
      SELECT pe.task_id, pe.notes
      FROM progress_entries pe
      INNER JOIN (
        SELECT task_id, MAX(report_id) as max_report
        FROM progress_entries
        GROUP BY task_id
      ) latest ON pe.task_id = latest.task_id AND pe.report_id = latest.max_report;
    `;
    const noteMap = new Map();
    notes.rows.forEach(n => noteMap.set(n.task_id, n.notes));

    const data = tasks.rows.map(task => {
      const progressList = progresses.rows.filter(p => p.task_id === task.id);
      const total_done = progressList.reduce((sum, p) => sum + Number(p.work_done_this_week || 0), 0);

      const parent = groupMap.get(task.parent_id);
      const grandParent = parent ? groupMap.get(parent.parent_id) : null;

      return {
        stt: task.stt,
        task_name: task.task_name,
        don_vi: task.unit,
        contract_volume: task.contract_volume,
        total_done,
        ghi_chu: noteMap.get(task.id) || '',
        nhom: parent?.task_name || '',
        hang_muc: grandParent?.task_name || ''
      };
    });

    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi khi tổng hợp dữ liệu báo cáo' });
  }
}
