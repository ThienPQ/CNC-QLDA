import formidable from "formidable";
import fs from "fs";
import { Client } from "pg";
import { parse } from "csv-parse";

export const config = { api: { bodyParser: false } };

const PGHOST = process.env.PGHOST;
const PGDATABASE = process.env.PGDATABASE;
const PGUSER = process.env.PGUSER;
const PGPASSWORD = process.env.PGPASSWORD;
const PGPORT = process.env.PGPORT || 5432;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const form = new formidable.IncomingForm({ keepExtensions: true });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "File upload error!" });
    if (!files || !files.file) return res.status(400).json({ error: "Missing file!" });
    const csvPath = files.file.filepath || files.file.path;

    const client = new Client({
      host: PGHOST,
      port: PGPORT,
      database: PGDATABASE,
      user: PGUSER,
      password: PGPASSWORD,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    let importCount = 0, errCount = 0, done = false;

    fs.createReadStream(csvPath)
      .pipe(parse({ columns: true, skip_empty_lines: true }))
      .on('data', async (row) => {
        try {
          await client.query(`
            INSERT INTO weekly_reports
              (week_sheet, group_code, group_name, sub_code, sub_name, task_code, task_name, unit,
               design_quantity, luuy_ke_den_nay, percent_in_week, percent_in_project, note)
            VALUES
              ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          `, [
            row.week_sheet,
            row.group_code,
            row.group_name,
            row.sub_code,
            row.sub_name,
            row.task_code,
            row.task_name,
            row.unit,
            row.design_quantity,
            row.luuy_ke_den_nay,
            row.percent_in_week,
            row.percent_in_project,
            row.note
          ]);
          importCount++;
        } catch (e) {
          errCount++;
        }
      })
      .on('end', async () => {
        if (!done) {
          done = true;
          await client.end();
          res.json({ ok: true, imported: importCount, errors: errCount });
        }
      })
      .on('error', async (err) => {
        if (!done) {
          done = true;
          await client.end();
          res.status(500).json({ error: 'CSV parse error: ' + err.message });
        }
      });
  });
}
