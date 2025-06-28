// pages/api/get-weekly-reports.js
import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
    });

    // Lấy báo cáo tuần mới nhất
    const [latestReportRows] = await connection.execute(`
      SELECT id FROM weekly_reports ORDER BY start_date DESC LIMIT 1
    `);

    if (latestReportRows.length === 0) {
      return res.status(200).json({ report_tasks: [] });
    }

    const reportId = latestReportRows[0].id;

    // Lấy danh sách công việc trong báo cáo tuần mới nhất
    const [tasks] = await connection.execute(
      `SELECT * FROM report_tasks WHERE report_id = ?`,
      [reportId]
    );

    // Lọc bỏ các dòng không có tên công việc
    const filteredTasks = tasks.filter(task => task.task_name && task.task_name.trim() !== '');

    res.status(200).json({ report_tasks: filteredTasks });
  } catch (error) {
    console.error('Lỗi truy vấn báo cáo:', error);
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu báo cáo' });
  }
}
