// pages/lanhdaoban.js
import { useEffect, useState } from "react";

function normalizeText(str) {
  // Chuẩn hóa: viết thường, bỏ dấu, bỏ cách thừa, giữ lại ký tự số/ chữ
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // bỏ dấu tiếng Việt
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9 ]/g, "") // chỉ giữ số/chữ/cách
    .toLowerCase()
    .trim();
}

function similar(a, b) {
  // so khớp "tương tự" (đủ dùng với báo cáo thực tế)
  return normalizeText(a) === normalizeText(b) || normalizeText(a).includes(normalizeText(b)) || normalizeText(b).includes(normalizeText(a));
}

function findBestMatch(sub_name, taskList) {
  if (!sub_name) return null;
  // Tìm công việc khớp nhất
  let normSub = normalizeText(sub_name);
  let best = null;
  let bestScore = 0;
  for (const t of taskList) {
    let normTask = normalizeText(t.sub_name);
    let score = 0;
    if (normSub === normTask) score = 2;
    else if (normTask.includes(normSub) || normSub.includes(normTask)) score = 1;
    else {
      // so khớp từ khoá
      let matches = normSub.split(" ").filter(x => normTask.includes(x));
      score = matches.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  // chỉ nhận nếu thực sự có điểm chung
  return bestScore > 0 ? best : null;
}

export default function LanhDaoBan() {
  const [weekly, setWeekly] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [fromDate, setFromDate] = useState("2025-06-16");
  const [toDate, setToDate] = useState("2025-06-22");
  const [aiResult, setAiResult] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);

  // Lấy báo cáo tuần
  useEffect(() => {
    fetch(`/api/get-weekly-reports?from_date=${fromDate}&to_date=${toDate}`)
      .then(res => res.json())
      .then(data => setWeekly(data?.data || []));
  }, [fromDate, toDate]);

  // Lấy PLHĐ (project_tasks)
  useEffect(() => {
    fetch(`/api/get-project-tasks`)
      .then(res => res.json())
      .then(data => setTasks(data?.data || []));
  }, []);

  // Gom nhóm, chuẩn hóa nhóm cha
  function groupByCategory(data) {
    let result = {};
    for (const row of data) {
      if (!row.group_code) continue;
      if (!result[row.group_code]) result[row.group_code] = { group_name: row.group_name, details: [] };
      result[row.group_code].details.push(row);
    }
    return result;
  }
  const grouped = groupByCategory(weekly);

  // Hàm gọi OpenAI GPT để đánh giá
  async function handleAIEval() {
    setLoadingAI(true);
    // Tạo chuỗi mô tả tình hình từng công việc
    let items = [];
    for (const row of weekly) {
      const matched = findBestMatch(row.sub_name, tasks);
      items.push({
        group: row.group_name,
        task: row.sub_name,
        design_week: row.thiet_ke,
        design_contract: matched?.design_quantity || "",
        percent_contract: matched?.percent_duan || "",
        note: row.note || "",
      });
    }
    // Tạo prompt cho AI
    const prompt = `
Bạn là một chuyên gia quản lý dự án giao thông. Hãy đọc các số liệu thực tế và hợp đồng dưới đây, đánh giá từng công việc đã đạt tiến độ chưa, so với hợp đồng, và đưa ra nhận xét/khuyến nghị cho từng công việc.
Kết quả trình bày dạng markdown, tách theo từng nhóm (Giao thông, Thoát nước...), mỗi công việc có: tên, tiến độ thực tế, tiến độ hợp đồng, nhận xét, khuyến nghị nếu cần.

Số liệu:
${items.map((it, idx) =>
  `${idx + 1}. Nhóm: ${it.group}, Công việc: ${it.task}, Khối lượng báo cáo tuần: ${it.design_week}, Khối lượng hợp đồng: ${it.design_contract}, Ghi chú: ${it.note}`
).join("\n")}
    `.trim();

    try {
      const resp = await fetch('/api/gpt-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const json = await resp.json();
      setAiResult(json.result || "Lỗi khi lấy đánh giá AI.");
    } catch (err) {
      setAiResult("Lỗi khi gọi AI.");
    }
    setLoadingAI(false);
  }

  // Tự động chạy AI mỗi khi weekly và tasks sẵn sàng
  useEffect(() => {
    if (weekly.length && tasks.length) handleAIEval();
    // eslint-disable-next-line
  }, [weekly, tasks]);

  // --- RENDER ---
  return (
    <div style={{ padding: 32 }}>
      <h1>Báo cáo tuần và đánh giá</h1>
      <div style={{ marginBottom: 24 }}>
        <label>Từ ngày: </label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        <label style={{ marginLeft: 16 }}>Đến ngày: </label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
      </div>
      {!weekly.length ? <div>Không có dữ liệu báo cáo.</div> :
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
                  <th>Thiết kế (báo cáo tuần)</th>
                  <th>Thiết kế (hợp đồng)</th>
                  <th>% Hoàn thành so với HĐ</th>
                  <th>Ghi chú</th>
                  <th>So khớp hợp đồng</th>
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
                  let soKhop = matched ? "Khớp công việc hợp đồng" : "Không khớp công việc hợp đồng";
                  return (
                    <tr key={row.id || row.sub_code || idx}>
                      <td>{idx + 1}</td>
                      <td>{row.sub_name}</td>
                      <td>{row.ly_trinh}</td>
                      <td>{row.unit}</td>
                      <td>{row.thiet_ke}</td>
                      <td>{matched?.design_quantity || "Không có trong hợp đồng"}</td>
                      <td>{percent || "Không xác định"}</td>
                      <td>{row.note}</td>
                      <td>{soKhop}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      }

      {/* Đánh giá AI */}
      <div style={{
        background: "#edfff0", padding: 18, borderRadius: 12,
        fontFamily: "monospace", marginTop: 36
      }}>
        <b>Đánh giá AI tổng hợp tự động:</b>
        <div style={{ marginTop: 10 }}>
          {loadingAI ? "Đang lấy đánh giá AI..." :
            <div dangerouslySetInnerHTML={{ __html: aiResult.replace(/\n/g, "<br/>") }} />
          }
        </div>
      </div>
    </div>
  );
}
