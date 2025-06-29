import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default async function handler(req, res) {
  try {
    const client = await pool.connect();
    const { rows } = await client.query(`
      SELECT group_code, group_name, sub_group_code, sub_group_name,
             task_name, unit, ly_trinh, thiet_ke, note,
             percent_week, percent_duan, from_date, to_date
      FROM weekly_reports
      ORDER BY group_code, sub_group_code, task_name, from_date
    `);
    client.release();

    // Tổng hợp theo group_code + sub_group_code + task_name
    const summary = {};
    for (const row of rows) {
      const key = [row.group_code, row.sub_group_code, row.task_name].join("|");
      if (!summary[key]) {
        summary[key] = {
          group_code: row.group_code,
          group_name: row.group_name,
          sub_group_code: row.sub_group_code,
          sub_group_name: row.sub_group_name,
          task_name: row.task_name,
          unit: row.unit,
          ly_trinh: row.ly_trinh,
          thiet_ke: row.thiet_ke,
          notes: [],
          percent_week: row.percent_week,
          percent_duan: row.percent_duan,
          from_date: row.from_date,
          to_date: row.to_date
        };
      }
      summary[key].notes.push(row.note);
      // Nếu là tuần mới nhất thì cập nhật percent
      if (row.from_date > summary[key].from_date) {
        summary[key].percent_week = row.percent_week;
        summary[key].percent_duan = row.percent_duan;
        summary[key].from_date = row.from_date;
        summary[key].to_date = row.to_date;
      }
    }
    res.status(200).json({ data: Object.values(summary) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
