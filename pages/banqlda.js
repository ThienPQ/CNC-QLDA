import { useState } from "react";
import * as XLSX from "xlsx";
import axios from "axios";

export default function BanQLDA() {
  const [reportFile, setReportFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [importResult, setImportResult] = useState(null);

  // Hàm chuẩn hóa số VN 3 số lẻ
  function formatVN(val) {
    if (val === undefined || val === null || val === '') return '';
    let s = String(val).replace(/\s/g, '').replace(/[^0-9.,-]/g, '');
    if (/^\d{1,3}(\.\d{3})*(\,\d+)?$/.test(s)) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (/^\d+(,\d+)?$/.test(s)) {
      s = s.replace(',', '.');
    }
    let num = Number(s);
    if (isNaN(num)) return '';
    let [nguyen, le] = num.toFixed(3).split('.');
    return nguyen.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + le;
  }

  // Chuyển file xlsx thành CSV và tự động upload
  const convertAndUploadCSV = async () => {
    setImportResult(null);
    if (!reportFile) return alert('Chọn file Excel trước');
    const data = await reportFile.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    // Tìm sheet "BC tuần..." mới nhất
    const bcSheets = workbook.SheetNames.filter(s =>
      s.trim().toLowerCase().startsWith('bc tuần')
    );
    if (!bcSheets.length) return alert('Không tìm thấy sheet "BC tuần..."');
    bcSheets.sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
    const sheetName = bcSheets[bcSheets.length - 1];
    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    let groupCode = '', groupName = '', subCode = '', subName = '';
    let collecting = false, csvRows = [];

    for (let row of rows) {
      const firstCol = (row[0] || '').toString().trim();
      if (!collecting && firstCol.toUpperCase().includes('CÔNG VIỆC THỰC HIỆN TRONG TUẦN')) {
        collecting = true;
        continue;
      }
      if (!collecting) continue;
      if (!row[1]) continue;

      if (/^[IVXLCDM]+$/.test(firstCol)) {
        groupCode = firstCol;
        groupName = row[1].toString().trim();
        subCode = subName = '';
        continue;
      }
      if (/^[IVXLCDM]+\.\d+$/.test(firstCol)) {
        subCode = firstCol;
        subName = row[1].toString().trim();
        continue;
      }
      if (/^\d+$/.test(firstCol) && subCode) {
        let taskCode = `${subCode}.${firstCol}`;
        let taskName = row[1] ? row[1].toString().trim() : '';
        let unit = row[3] ? row[3].toString().trim() : '';
        let design_quantity = formatVN(row[4]);
        let luuy_ke_den_nay = formatVN(row[8]);
        let percent_in_week = formatVN(row[9]);
        let percent_in_project = formatVN(row[10]);
        let note = row[16] ? row[16].toString().trim() : '';
        csvRows.push([
          sheetName, groupCode, groupName, subCode, subName, taskCode, taskName, unit,
          design_quantity, luuy_ke_den_nay, percent_in_week, percent_in_project, note
        ]);
      }
    }

    // Header
    const header = [
      "week_sheet", "group_code", "group_name", "sub_code", "sub_name", "task_code", "task_name", "unit",
      "design_quantity", "luuy_ke_den_nay", "percent_in_week", "percent_in_project", "note"
    ];
    const allRows = [header, ...csvRows];
    setCsvPreview(allRows.slice(0, 11)); // preview 10 dòng đầu

    // Tạo file CSV (blob)
    const csvContent = allRows
      .map(row => row.map(cell => `"${cell || ""}"`).join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const file = new File([blob], `bao_cao_tuan_${sheetName.replace(/\s/g, '_')}.csv`, { type: "text/csv" });

    // Upload CSV vào DB
    const form = new FormData();
    form.append('file', file);

    try {
      const res = await axios.post('/api/upload-csv-to-db', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportResult(res.data && res.data.ok
        ? `Đã nhập thành công ${res.data.imported} dòng vào DB!`
        : 'Có lỗi khi nhập dữ liệu báo cáo tuần.');
    } catch {
      setImportResult('Lỗi upload CSV');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Chọn và tải lên Báo cáo Tuần (Excel)</h2>
      <input type="file" accept=".xlsx" onChange={e => setReportFile(e.target.files[0])} />
      <button onClick={convertAndUploadCSV} style={{ marginLeft: 12 }}>Chuyển &amp; Upload vào DB</button>

      {csvPreview.length > 0 &&
        <div>
          <h4 style={{ marginTop: 24 }}>Xem nhanh dữ liệu chuẩn hóa (10 dòng đầu):</h4>
          <div style={{ maxHeight: 280, overflow: 'auto', border: "1px solid #eee" }}>
            <table border={1} style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
              <thead>
                <tr>{csvPreview[0].map((c, idx) => <th key={idx}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {csvPreview.slice(1).map((row, idx) =>
                  <tr key={idx}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      }

      {importResult &&
        <div style={{ margin: "28px 0", color: "#1976d2", fontWeight: 600 }}>{importResult}</div>
      }
    </div>
  );
}
