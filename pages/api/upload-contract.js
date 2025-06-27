// pages/api/upload-contract.js
import { formidable } from 'formidable';
import { sql } from '@vercel/postgres';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ hỗ trợ phương thức POST' });
  }

  const form = formidable();

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Lỗi khi xử lý tệp' });

    const file = files.file;
    if (!file) return res.status(400).json({ error: 'Không có tệp được tải lên' });

    try {
      const xlsx = await import('xlsx');
      const workbook = xlsx.readFile(file.filepath);
      const sheet = workbook.Sheets['Mẫu số 11C'];
      if (!sheet) return res.status(400).json({ error: 'Không tìm thấy sheet "Mẫu số 11C"' });

      const raw = xlsx.utils.sheet_to_json(sheet, { header: 1 });

      let currentHangMucId = null;
      let currentGroupId = null;

      for (let i = 6; i < raw.length; i++) {
        const row = raw[i];
        const stt = row[0];
        const name = row[1];
        const unit = row[2];
        const volume = row[4];

        if (!stt || !name) continue;
        const level = (typeof stt === 'string' && stt.match(/\./g))?.length || 0;

        if (name.toUpperCase().includes('HẠNG MỤC')) {
          const result = await sql`
            INSERT INTO project_tasks (stt, task_name, is_group, parent_id)
            VALUES (${stt}, ${name}, true, null)
            RETURNING id;
          `;
          currentHangMucId = result.rows[0].id;
          currentGroupId = null;
        } else if (level === 1) {
          const result = await sql`
            INSERT INTO project_tasks (stt, task_name, is_group, parent_id)
            VALUES (${stt}, ${name}, true, ${currentHangMucId})
            RETURNING id;
          `;
          currentGroupId = result.rows[0].id;
        } else if (level >= 2 && volume) {
          await sql`
            INSERT INTO project_tasks (stt, task_name, unit, contract_volume, is_group, parent_id)
            VALUES (${stt}, ${name}, ${unit}, ${Number(volume)}, false, ${currentGroupId});
          `;
        }
      }

      res.status(200).json({ message: 'Tải và lưu hợp đồng thành công' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Lỗi khi xử lý file Excel' });
    }
  });
}
