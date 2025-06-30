// pages/lanhdaoban.js
import { useState, useEffect } from "react";
import axios from "axios";

// Chuẩn hóa chuỗi cho so sánh "gần đúng"
function normalize(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD") // Loại dấu tiếng Việt
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ") // Loại ký tự đặc biệt
    .replace(/\s+/g, " ")
    .trim();
}

// So khớp tên công việc báo cáo với hợp đồng (lấy cái giống nhất)
function findMostSimilar(subName, projectTasks) {
  if (!subName) return null;
  const norm = normalize(subName);
  let maxScore = -1;
  let best = null;
  projectTasks.forEach(task => {
    const normTask = normalize(task.task_name || task.sub_name);
    // Tính số ký tự trùng đầu chuỗi (có thể nâng cao bằng Levenshtein nếu muốn)
    let score = 0;
    for (let i = 0; i < Math.min(norm.length, normTask.length); i++) {
      if (norm[i] === normTask[i]) score++; else break;
    }
    if (score > maxScore) { maxScore = score; best = task; }
  });
  return best;
}

export default function LanhDaoBan() {
  const [data, setData] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [fromDate, setFromDate] = useState("2025-06-09");
  const [toDate, setToDate] = useState("2025-06-22");
  const [error, setError] = useState(null);

  useEffect(() => {
    axios
      .get("/api/get-weekly-reports", { params: { fromDate, toDate } })
      .then((res) => setData(res.data))
      .catch(() => setError("Không thể tải dữ liệu báo cáo"));

    axios
      .get("/api/get-project-tasks")
      .then(res => setProjectTasks(res.data))
      .catch(() => {});
  }, [fromDate, toDate]);

  // Nhóm dữ liệu theo group_code (hạng mục cha)
  const groupData = {};
  data.forEach(item => {
    if (!groupData[item.group_code])
      groupData[item.group_code] = { name: item.group_name, subs: {} };
    if (!groupData[item.group_code].subs[item.sub_code])
      groupData[item.group_code].subs[item.sub_code] = { name: item.sub_name, rows: [] };
    groupData[item.group_code].subs[item.sub_code].rows.push(item);
  });

  // Cộng dồn các trường số
  const sumField = (arr, field) => arr.reduce((acc, curr) => acc + (parseFloat(curr[field]) || 0), 0);

  return (
    <div style={{ padding: 20 }}>
      <h1>Báo cáo tuần và đánh giá</h1>
      <div style={{ marginBottom: 12 }}>
        <span>Từ ngày: </span>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        <span> Đến ngày: </span>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
      </div>
      {error && <div style={{ color: "red" }}>{error}</div>}

      {Object.keys(groupData).length === 0 ? (
        <p>Không có dữ liệu báo cáo.</p>
      ) : (
        Object.entries(groupData).map(([group_code, group]) => (
          <div key={group_code}>
            <h2 style={{ marginTop: 20 }}>{group_code} - {group.name}</h2>
            {Object.entries(group.subs).map(([sub_code, sub], idx) => {
              // Tìm công việc hợp đồng gần giống nhất với tên công việc trong báo cáo
              const matchedTask = findMostSimilar(sub.name, projectTasks);
              const designContract = matchedTask ? matchedTask.design_quantity || matchedTask.thiet_ke || "" : "";
              const thiet_ke = sumField(sub.rows, "thiet_ke");
              const percent = designContract && parseFloat(designContract) > 0
                ? ((thiet_ke / parseFloat(designContract)) * 100).toFixed(1)
                : "";

              return (
                <table
                  border={1}
                  cellPadding={5}
                  style={{ width: "100%", marginBottom: 12, background: idx % 2 === 0 ? "#fff" : "#f8f8f8" }}
                  key={sub_code}
                >
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
                    <tr>
                      <td>1</td>
                      <td>{sub.name}</td>
                      <td>{sub.rows.map(x => x.ly_trinh).filter(Boolean).join("; ")}</td>
                      <td>{sub.rows.map(x => x.unit).filter(Boolean).join("; ")}</td>
                      <td>{thiet_ke}</td>
                      <td>{designContract || "Không có trong hợp đồng"}</td>
                      <td>{percent ? percent + "%" : "Không xác định"}</td>
                      <td>{sub.rows.map(x => x.note).filter(Boolean).join("; ")}</td>
                      <td>
                        {matchedTask
                          ? (matchedTask.task_name || matchedTask.sub_name)
                          : "Không khớp công việc hợp đồng"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              );
            })}
          </div>
        ))
      )}

      {/* Đánh giá AI tổng hợp phía dưới */}
      <div style={{ background: "#eaffea", marginTop: 20, padding: 24 }}>
        <b>Đánh giá AI tự động</b>
        <div>
          <div>Đánh giá tổng hợp tự động:</div>
          {Object.entries(groupData).map(([group_code, group]) => (
            <div key={group_code} style={{ marginBottom: 10 }}>
              <b>- {group_code} - {group.name}:</b>
              <ul>
                {Object.entries(group.subs).map(([sub_code, sub]) => {
                  const matchedTask = findMostSimilar(sub.name, projectTasks);
                  const thiet_ke = sumField(sub.rows, "thiet_ke");
                  const designContract = matchedTask ? matchedTask.design_quantity || matchedTask.thiet_ke || "" : "";
                  const percent = designContract && parseFloat(designContract) > 0
                    ? ((thiet_ke / parseFloat(designContract)) * 100).toFixed(1)
                    : "";
                  return (
                    <li key={sub_code}>
                      {sub.name}: {percent
                        ? `Đạt ${percent}% so với hợp đồng (${thiet_ke}/${designContract})`
                        : "Không xác định (không khớp hợp đồng)"}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
