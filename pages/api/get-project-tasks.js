import { Pool } from 'pg';

// Kết nối CSDL Neon/Vercel qua biến môi trường DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  try {
    // Lấy toàn bộ dữ liệu bảng project_tasks (có thể đổi tên bảng đúng với CSDL của bạn nếu khác)
    const { rows } = await pool.query('SELECT * FROM project_tasks');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Lỗi lấy project_tasks:', error);
    res.status(500).json({ error: error.message });
  }
}
