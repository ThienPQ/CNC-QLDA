import { useEffect, useState } from "react";

// --- Chuẩn hóa tên công việc mạnh mẽ ---
const STOPWORDS = [
  "công", "việc", "thi", "công", "xây", "dựng", "hạng", "mục", "lắp", "đặt", "làm",
  "và", "các", "của", "bằng", "trên", "tại", "theo", "cho", "đến", "kèm", "như", "bổ sung"
];
function normalizeTaskName(str) {
  if (!str) return "";
  let s = str.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let arr = s.split(" ").filter(w => w && !STOPWORDS.includes(w));
  return arr.join(" ");
}
function findBestMatch(taskName, plhdTasks) {
  if (!taskName) return null;
  const n1 = normalizeTaskName(taskName);
  let best = null, bestScore = 0;
  for (const t of plhdTasks) {
    const n2 = normalizeTaskName(t.sub_name);
    if (!n2) continue;
    let score = 0;
    if (n1 === n2) score = 100;
    else if (n1.includes(n2) || n2.includes(n1)) score = 80;
    else {
      const set1 = new Set(n1.split(" ")), set2 = new Set(n2.split(" "));
      score = [...set1].filter(x => set2.has(x)).length * 10;
    }
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return bestScore >= 20 ? best : null;
}

// --- Gom nhóm, cộng dồn ---
function groupByCategory(rows) {
  let result = {};
  for (const row of rows) {
    if (!row.group_code) continue;
    if (!result[row.group_code]) result[row.group_code] = { group_name: row.group_name, details: [] };
    result[row.group_code].details.push(row);
  }
  return result;
}
function mergeReports(reports) {
  let map = {};
  for (let r of reports) {
    const key = [r.group_code, normalizeTaskName(r.sub_name), r.unit].join("|");
    if (!map[key]) {
      map[key] = { ...r, thiet_ke: parseFloat(r.thiet_ke) || 0, percent_week: 0, percent_duan: 0 };
      map[key]._all_notes = [];
      if (r.note) map[key]._all_notes.push(r.note);
    } else {
      map[key].thiet_ke += parseFloat(r.thiet_ke) || 0;
      map[key].percent_week = Math.max(map[key].percent_week, parseFloat(r.percent_week) || 0);
      map[key].percent_duan = Math.max(map[key].percent_duan, parseFloat(r.percent_duan) || 0);
      if (r.note) map[key]._all_notes.push(r.note);
    }
  }
  for (const k in map) map[k].note = map[k]._all_notes.join("; ");
  return Object.values(map);
}

function compareWithPrevWeek(merged, prev) {
  let result = { nhanh: [], cham: [] };
  for (let row of merged) {
    const prevRow = prev.find(
      x => normalizeTaskName(x.sub_name) === normalizeTaskName(row.sub_name) && x.unit === row.unit && x.group_code === row.group_code
    );
    if (!prevRow) continue;
    const d = parseFloat(row.thiet_ke) - parseFloat(prevRow.thiet_ke);
    if (d > 0) result.nhanh.push({ ...row, tang: d });
    else if (d < 0) result.cham.push({ ...row, giam: d });
  }
  return result;
}

export default function LanhDaoBan() {
  const [weekly, setWeekly] = useState([]);        // Báo cáo tuần
  const [tasks, setTasks] = useState([]);          // Hợp đồng
  const [fromDate, setFromDate] = useState("2025-06-09");
  const [toDate, setToDate] = useState("2025-06-22");
  const [prevWeek, setPrevWeek] = useState([]);
  const [aiAuto, setAiAuto] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);

  // --- Lấy dữ liệu báo cáo tuần ---
  useEffect(() => {
    fetch(`/api/get-weekly-reports?from_date=${fromDate}&to_date=${toDate}`)
      .then(res => res.json())
      .then(data => setWeekly(data?.data || []));
    // Tuần trước
    let prevTo = new Date(fromDate);
    prevTo.setDate(prevTo.getDate() - 1);
    let prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - 6);
    fetch(`/api/get-weekly-reports?from_date=${prevFrom.toISOString().slice(0,10)}&to_date=${prevTo.toISOString().slice(0,10)}`)
      .then(res => res.json())
      .then(data => setPrevWeek(data?.data || []));
  }, [fromDate, toDate]);

  // --- Lấy danh mục hợp đồng ---
  useEffect(() => {
    fetch(`/api/get-project-tasks`)
      .then(res => res.json())
      .then(data => setTasks(data?.data || []));
  }, []);

  // --- Xử lý cộng dồn ---
  const merged = mergeReports(weekly.filter(r =>
    r.from_date >= fromDate && r.to_date <= toDate
  ));
  const grouped = groupByCategory(merged);

  // --- So sánh với tuần trước ---
  const prevMerged = mergeReports(prevWeek);
  const speedCompare = compareWithPrevWeek(merged, prevMerged);

  // --- AI auto nhận xét tổng quan ---
  useEffect(() => {
    if (!merged.length || !tasks.length) { setAiAuto(""); return; }
    let text = "";
    for (const [code, group] of Object.entries(grouped)) {
      text += `\n${code} - ${group.group_name}\n`;
      for (const row of group.details) {
        const matched = findBestMatch(row.sub_name, tasks);
        let done = row.thiet_ke;
        let contract = matched?.design_quantity || "";
        let percent = contract ? ((done / contract) * 100).toFixed(1) : "";
        let trend = "";
        const isFast = speedCompare.nhanh.find(x => normalizeTaskName(x.sub_name) === normalizeTaskName(row.sub_name));
        const isSlow = speedCompare.cham.find(x => normalizeTaskName(x.sub_name) === normalizeTaskName(row.sub_name));
        if (isFast) trend = "Tăng tiến độ so với tuần trước.";
        else if (isSlow) trend = "Giảm tiến độ hoặc dừng.";
        text += `- ${row.sub_name}: ${done}/${contract} (${percent}%) ${trend}\n`;
      }
    }
    setAiAuto(text.trim());
  }, [merged, tasks, grouped, speedCompare]);

  // --- Đánh giá AI khi bấm nút ---
  async function handleAIEval() {
    setLoadingAI(true);
    const items = merged.filter(row => row.note && row.note.trim() !== "");
    if (!items.length) {
      setAiResult("Không có công việc nào có ghi chú.");
      setLoadingAI(false);
      return;
    }
    let prompt = `
Bạn là chuyên gia quản lý dự án. Với từng công việc dưới đây, hãy đánh giá tiến độ so với hợp đồng (nếu có), phân tích các vấn đề từ ghi chú, đề xuất hướng xử lý. Trình bày gọn, rõ ràng từng công việc.

${items.map((it, idx) => {
  const matched = findBestMatch(it.sub_name, tasks);
  return `${idx + 1}. Nhóm: ${it.group_name}, Công việc: ${it.sub_name}, Khối lượng lũy kế: ${it.thiet_ke} ${it.unit}, Hợp đồng: ${matched?.design_quantity || ""} ${it.unit}, Ghi chú: ${it.note}`;
}).join("\n")}
    `.trim();
    try {
      const resp = await fetch("/api/gpt-eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const json = await resp.json();
      setAiResult(json.result || "Không lấy được đánh giá AI.");
    } catch (err) {
      setAiResult("Lỗi khi gọi AI.");
    }
    setLoadingAI(false);
  }

  // ======= HIỂN THỊ ==========
  return (
    <div style={{ padding: 32 }}>
      <h1>Báo cáo tuần và đánh giá</h1>
      <div style={{ marginBottom: 24 }}>
        <label>Từ ngày: </label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        <label style={{ marginLeft: 16 }}>Đến ngày: </label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
      </div>
      {!merged.length ? <div>Không có dữ liệu báo cáo.</div> :
        Object.entries(grouped).map(([code, { group_name, details }]) => (
          <div key={code} style={{ marginBottom: 32 }}>
            <h2>{code} - {group_name}</h2>
            <table border={1} cellPadding={6} cellSpacing={0} style={{ width: "100%", background: "#fff" }}>
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Tên công việc</th>
                  <th>Lý trình</th>
                  <th>Đơn vị</th>
                  <th>Thiết kế lũy kế</th>
                  <th>Thiết kế HĐ</th>
                  <th>% Hoàn thành HĐ</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {details.map((row, idx) => {
                  const matched = findBestMatch(row.sub_name, tasks);
                  let percent = "";
                  if (matched?.design_quantity && row.thiet_ke) {
                    let val = parseFloat(row.thiet_ke) / parseFloat(matched.design_quantity) * 100;
                    percent = isNaN(val) ? "" : val.toFixed(1) + "%";
                  }
                  return (
                    <tr key={row.id || row.sub_code || idx}>
                      <td>{idx + 1}</td>
                      <td>{row.sub_name}</td>
                      <td>{row.ly_trinh}</td>
                      <td>{row.unit}</td>
                      <td>{row.thiet_ke}</td>
                      <td>{matched?.design_quantity || ""}</td>
                      <td>{percent}</td>
                      <td>{row.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      }
      {/* AI tự động nhận xét */}
      <div style={{
        background: "#eef7ff", padding: 18, borderRadius: 12,
        fontFamily: "monospace", marginTop: 36
      }}>
        <b>AI tự động nhận xét tổng quan:</b>
        <div style={{ marginTop: 10, whiteSpace: "pre-line" }}>{aiAuto}</div>
      </div>
      {/* Nút đánh giá AI */}
      <div style={{
        background: "#edfff0", padding: 18, borderRadius: 12,
        fontFamily: "monospace", marginTop: 24
      }}>
        <b>Đánh giá AI chi tiết từng công việc có ghi chú:</b><br />
        <button onClick={handleAIEval} disabled={loadingAI} style={{ margin: 12, padding: "8px 20px", background: "#41e09a", borderRadius: 8, fontWeight: 600 }}>
          {loadingAI ? "Đang đánh giá..." : "Đánh giá AI"}
        </button>
        <div style={{ marginTop: 10, whiteSpace: "pre-line" }}>{aiResult}</div>
      </div>
    </div>
  );
}
