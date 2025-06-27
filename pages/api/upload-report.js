import { v2 as cloudinary } from 'cloudinary';
import formidable from 'formidable';
import xlsx from 'xlsx';
import { sql } from '@vercel/postgres';

export const config = { api: { bodyParser: false } };
cloudinary.config({ /* Cấu hình Cloudinary của bạn */ });

async function handleContractUpload(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets['Mẫu số 11C'];
    if (!sheet) throw new Error("Không tìm thấy sheet 'Mẫu số 11C'");

    const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const headerRowIndex = data.findIndex(r => String(r[0]).trim().toUpperCase() === 'STT');
    if (headerRowIndex === -1) throw new Error("Không tìm thấy dòng tiêu đề 'STT'");

    const headers = data[headerRowIndex].map(h => String(h || '').trim());
    const rows = data.slice(headerRowIndex + 1);

    const descIdx = headers.findIndex(h => h.includes('Tên công việc'));
    const unitIdx = headers.findIndex(h => h === 'Đơn vị');
    const volumeIdx = headers.findIndex(h => h === 'Khối lượng');

    await sql`TRUNCATE TABLE progress_entries, weekly_reports, project_tasks RESTART IDENTITY CASCADE;`;

    let level1Id = null, level2Id = null;
    for (const row of rows) {
        const stt = String(row[0] || '').trim();
        const desc = row[descIdx];
        if (!desc || !stt) continue;

        if (stt.match(/^[A-Z]$/)) { // Cấp 1: A, B...
            const res = await sql`INSERT INTO project_tasks (task_name, is_group, stt) VALUES (${desc}, TRUE, ${stt}) RETURNING id;`;
            level1Id = res.rows[0].id;
        } else if (stt.match(/^[IVXLC]+$/)) { // Cấp 2: I, II...
            const res = await sql`INSERT INTO project_tasks (task_name, parent_id, is_group, stt) VALUES (${desc}, ${level1Id}, TRUE, ${stt}) RETURNING id;`;
            level2Id = res.rows[0].id;
        } else if (!isNaN(Number(stt))) { // Cấp 3: 1, 2...
            await sql`INSERT INTO project_tasks (task_name, parent_id, contract_volume, unit, stt) VALUES (${desc}, ${level2Id}, ${row[volumeIdx]}, ${row[unitIdx]}, ${stt});`;
        }
    }
}

async function handleWeeklyReportUpload(filePath, fields) {
    const { fromDate, toDate } = fields;
    if (!fromDate || !toDate) throw new Error('Thiếu thông tin ngày.');

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('báo cáo tuần'));
    if (!sheetName) throw new Error('Không tìm thấy sheet báo cáo tuần.');
    const sheet = workbook.Sheets[sheetName];

    const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const headerRowIndex = data.findIndex(r => String(r[0]).trim().toUpperCase() === 'STT');
    if (headerRowIndex === -1) throw new Error("Không tìm thấy dòng tiêu đề 'STT' trong báo cáo tuần.");

    const headers = data[headerRowIndex].map(h => String(h || '').trim());
    const rows = data.slice(headerRowIndex + 1);

    const descIdx = headers.findIndex(h => h.toUpperCase() === 'CÔNG VIỆC' || h.toUpperCase() === 'HẠNG MỤC CÔNG VIỆC');
    const workDoneIdx = headers.findIndex(h => h === 'Thực hiện');
    const cumulativeIdx = headers.findIndex(h => h === 'Lũy kế đến nay');
    const notesIdx = headers.findIndex(h => h === 'Ghi chú');

    const reportResult = await sql`INSERT INTO weekly_reports (start_date, end_date) VALUES (${fromDate}, ${toDate}) ON CONFLICT (start_date, end_date) DO UPDATE SET end_date = EXCLUDED.end_date RETURNING id;`;
    const reportId = reportResult.rows[0].id;

    for (const row of rows) {
        const taskName = row[descIdx];
        const stt = String(row[0] || '').trim();
        if (taskName && !stt.match(/^[IVXLC]/i) && !stt.match(/\./)) {
            const taskResult = await sql`SELECT id FROM project_tasks WHERE task_name = ${taskName} AND is_group = FALSE;`;
            if (taskResult.rows.length > 0) {
                await sql`INSERT INTO progress_entries (report_id, task_id, work_done_this_week, cumulative_work_done, notes) VALUES (${reportId}, ${taskResult.rows[0].id}, ${row[workDoneIdx] || 0}, ${row[cumulativeIdx] || 0}, ${row[notesIdx] || ''}) ON CONFLICT (report_id, task_id) DO UPDATE SET work_done_this_week = EXCLUDED.work_done_this_week, cumulative_work_done = EXCLUDED.cumulative_work_done, notes = EXCLUDED.notes;`;
            }
        }
    }
}


export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const form = formidable({});
    form.parse(req, async (err, fields, files) => {
        try {
            const file = files.file?.[0];
            const desiredFilename = fields.filename?.[0];
            if (!file || !desiredFilename) throw new Error('File hoặc loại file không hợp lệ.');
            
            await cloudinary.uploader.upload(file.filepath, { resource_type: 'raw', public_id: desiredFilename, overwrite: true });
            
            if (desiredFilename === 'PLHD.xlsx') await handleContractUpload(file.filepath);
            else if (desiredFilename === 'bao-cao-tuan.xlsx') await handleWeeklyReportUpload(file.filepath, { fromDate: fields.fromDate?.[0], toDate: fields.toDate?.[0] });
            
            res.status(200).json({ message: `Xử lý thành công file: ${desiredFilename}` });
        } catch (error) {
            console.error("Lỗi trong quá trình upload:", error);
            res.status(500).json({ error: error.message });
        }
    });
}