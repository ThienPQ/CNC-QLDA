import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  try {
    const client = await pool.connect();
    const { rows } = await client.query(`
      SELECT t.parent_code, t.parent_name, t.group_code, t.group_name,
             t.task_name, t.unit, t.note, t.percent_week, t.percent_project, t.volume,
             w.from_date, w.to_date
      FROM report_tasks t
      JOIN weekly_reports w ON t.report_id = w.id
      ORDER BY t.parent_code, t.group_code, t.task_name, w.from_date
    `);
    client.release();

    // Tổng hợp theo nhóm (parent_code + group_code + task_name)
    const summary = {};
    for (const row of rows) {
      const key = [row.parent_code, row.group_code, row.task_name].join("|");
      if (!summary[key]) {
        summary[key] = {
          parent_code: row.parent_code,
          parent_name: row.parent_name,
          group_code: row.group_code,
          group_name: row.group_name,
          task_name: row.task_name,
          unit: row.unit,
          total_volume: 0,
          notes: [],
          latest_percent_week: row.percent_week,
          latest_percent_project: row.percent_project,
          from_date: row.from_date,
          to_date: row.to_date
        };
      }
      summary[key].total_volume += Number(row.volume) || 0;
      summary[key].notes.push(row.note);
      if (row.from_date > summary[key].from_date) {
        summary[key].latest_percent_week = row.percent_week;
        summary[key].latest_percent_project = row.percent_project;
        summary[key].from_date = row.from_date;
        summary[key].to_date = row.to_date;
      }
    }
    res.status(200).json({ data: Object.values(summary) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
