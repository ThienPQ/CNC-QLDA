import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_oMpHF1ezSvD3@ep-floral-pine-a4gxll7g-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
});

export default async function handler(req, res) {
  try {
    const { fromDate, toDate } = req.query;
    // Lấy số liệu báo cáo tuần
    const weekQuery = `
      SELECT group_code, group_name, sub_code, sub_name, ly_trinh, unit,
        SUM(COALESCE(thiet_ke::float, 0)) as thiet_ke,
        MAX(COALESCE(percent_week::float, 0)) as percent_week,
        MAX(COALESCE(percent_duan::float, 0)) as percent_duan,
        STRING_AGG(note, '; ') as note
      FROM weekly_reports
      WHERE from_date >= $1 AND to_date <= $2
      GROUP BY group_code, group_name, sub_code, sub_name, ly_trinh, unit
      ORDER BY group_code, sub_code;
    `;
    const { rows: weekData } = await pool.query(weekQuery, [fromDate, toDate]);

    // Lấy số liệu PLHĐ
    const hdQuery = `SELECT * FROM project_tasks`;
    const { rows: hdData } = await pool.query(hdQuery);

    // Ghép và so sánh
    const merged = weekData.map(week => {
      const hd = hdData.find(
        d => d.group_code === week.group_code && d.sub_code === week.sub_code
      );
      let percent_contract = '';
      let status = '';
      if (hd && hd.thiet_ke_hd) {
        percent_contract = ((week.thiet_ke / parseFloat(hd.thiet_ke_hd)) * 100).toFixed(2);
        if (week.thiet_ke >= hd.thiet_ke_hd) status = 'Hoàn thành hoặc vượt tiến độ';
        else if (percent_contract >= 90) status = 'Đúng tiến độ (đạt ≥90% khối lượng)';
        else status = 'Chậm tiến độ';
      } else {
        status = "Chưa có dữ liệu hợp đồng";
      }
      return {
        ...week,
        thiet_ke_hd: hd?.thiet_ke_hd || '',
        percent_contract,
        status
      };
    });

    res.status(200).json({ data: merged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
