import { useEffect, useState } from "react";
import Head from "next/head";
import axios from "axios";

// Chuẩn hóa tên công việc (chỉ dùng để nhận diện "Vét hữu cơ")
function normalizeString(str) {
  if (!str) return "";
  let s = str
    .replace(/đắp đất nền đường, độ chặt yêu cầu k[= ]*0[.,]?90/gi, "đắp nền k90")
    .replace(/đắp đất nền đường, độ chặt yêu cầu k[= ]*0[.,]?95/gi, "đắp nền k95")
    .replace(/đắp đất nền đường, độ chặt yêu cầu k[= ]*0[.,]?98/gi, "đắp nền k98")
    .replace(/đắp đất nền đường/gi, "đắp nền")
    .replace(/độ chặt yêu cầu/gi, "")
    .replace(/đắp đất/gi, "đắp nền")
    .replace(/[\n\r\t"';,]+/g, " ")
    .replace(/K[= :]*0[.,]?90?\b/gi, "K90")
    .replace(/K[= :]*0[.,]?95\b/gi, "K95")
    .replace(/K[= :]*0[.,]?98\b/gi, "K98");
  s = s.replace(/[^a-zA-Z0-9 ]/g, " ");
  s = s.toLowerCase().replace(/\s+/g, " ").trim();
  return s;
}

// Chuẩn hóa số hợp đồng kiểu VN cho các trường hợp thông thường
function parseVnContractNumber(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  if (/^\d+\.\d{3}$/.test(val)) {
    return Number(val.replace(/\./, ""));
  }
  if (/^\d+\.\d{2}$/.test(val)) {
    return Number(val.replace(/\./, "") + "0");
  }
  if (/^\d+\.\d+$/.test(val)) {
    const arr = val.split(".");
    if (arr[1].length === 3) return Number(arr[0] + arr[1]);
    if (arr[1].length === 2) return Number(arr[0] + arr[1] + "0");
    return Number(arr.join(""));
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(val)) {
    return Number(val.replace(/\./g, ""));
  }
  return Number(val);
}

function formatNumber(num) {
  if (typeof num !== "number") num = Number(num);
  if (isNaN(num)) return "";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Đọc số hợp đồng tổng quát
function calcContractQuantity(val, unit) {
  let num = parseVnContractNumber(val);
  if (!unit) return num;
  let match = unit.match(/^(\d+)\s*(m3|m2|m)$/i);
  if (match) {
    let factor = Number(match[1]);
    if (!isNaN(factor)) {
      return num * factor;
    }
  }
  return num;
}

// So khớp công việc hợp đồng: chỉ exact match
function findProjectTask(subName, projectTasks) {
  const n1 = normalizeString(subName);
  if (!n1) return null;
  let found = projectTasks.find(pt => {
    const n2 = normalizeString(pt.task_name);
    return n1 === n2;
  });
  return found || null;
}

// Phân nhóm dữ liệu theo group cha -> tuyến -> công việc
function groupByHierarchy(weeklyReports, projectTasks) {
  const result = {};
  for (const row of weeklyReports) {
    const group = row.group_name || row.group_code || "Nhóm khác";
    const route = row.tuyen || row.tuyen_name || row.group_sub_name || "Chưa rõ tuyến";
    const matched = findProjectTask(row.sub_name, projectTasks);
    if (!matched) continue;
    if (!result[group]) result[group] = {};
    if (!result[group][route]) result[group][route] = {};
    const taskKey = matched.task_name;
    if (!result[group][route][taskKey]) {
      result[group][route][taskKey] = {
        task: matched,
        totalActual: 0,
        contractQty: calcContractQuantity(
          matched.design_quantity,
          matched.unit || matched.donvi || matched.dvt
        ),
        listRows: [],
      };
    }
    // Chỉ lấy báo cáo của tuần mới nhất!
    const v = row.thiet_ke ? parseFloat(row.thiet_ke) : 0;
    if (!isNaN(v) && v > 0) {
      result[group][route][taskKey].totalActual += v;
      result[group][route][taskKey].listRows.push(row);
    }
    // Ghi chú lấy từ báo cáo tuần mới nhất (theo ngày)
    result[group][route][taskKey].note = row.note || "";
    result[group][route][taskKey].to_date = row.to_date || "";
  }
  // Làm phẳng và sort các tuần mới nhất
  Object.values(result).forEach(routes => {
    Object.values(routes).forEach(tasks => {
      Object.values(tasks).forEach(item => {
        if (item.listRows && item.listRows.length > 1) {
          item.listRows.sort((a, b) => (b.to_date > a.to_date ? 1 : -1));
          item.note = item.listRows[0].note || "";
          item.to_date = item.listRows[0].to_date || "";
        }
      });
    });
  });
  return result;
}

export default function LanhDaoBan() {
  const [weeklyReports, setWeeklyReports] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState("");
  const [aiResult, setAiResult] = useState("");

  useEffect(() => {
    async function fetchWeeklyReportsAndSetDefaultDates() {
      try {
        const res = await axios.get("/api/get-weekly-reports");
        const data = res.data || [];
        setWeeklyReports(data);
        if (data.length > 0) {
          let maxToDate = data[0].to_date;
          data.forEach(row => {
            if (row.to_date && row.to_date > maxToDate) maxToDate = row.to_date;
          });
          let minFromDate = data.find(row => row.to_date === maxToDate)?.from_date || data[0].from_date;
          setFromDate(minFromDate);
          setToDate(maxToDate);
        }
        setError("");
      } catch (err) {
        setError("Không thể tải dữ liệu báo cáo");
        setWeeklyReports([]);
      }
    }
    async function fetchProjectTasks() {
      try {
        const res = await axios.get("/api/get-project-tasks");
        setProjectTasks(res.data || []);
      } catch (err) {
        setProjectTasks([]);
      }
    }
    fetchWeeklyReportsAndSetDefaultDates();
    fetchProjectTasks();
  }, []);

  useEffect(() => {
    if (!fromDate || !toDate) return;
    async function fetchData() {
      try {
        const res = await axios.get("/api/get-weekly-reports", {
          params: { fromDate, toDate },
        });
        setWeeklyReports(res.data || []);
        setError("");
      } catch (err) {
        setError("Không thể tải dữ liệu báo cáo");
        setWeeklyReports([]);
      }
    }
    fetchData();
  }, [fromDate, toDate]);

  const grouped = groupByHierarchy(weeklyReports, projectTasks);

  // Chuẩn bị dữ liệu AI đánh giá
  function handleAIDanhGia() {
    const allTasksWithNote = [];
    Object.entries(grouped).forEach(([group, routes]) => {
      Object.entries(routes).forEach(([route, tasks]) => {
        Object.values(tasks).forEach(item => {
          if (item.note && item.note.trim() !== "") {
            allTasksWithNote.push({
              group,
              route,
              task: item.task.task_name,
              note: item.note,
              actual: formatNumber(item.totalActual),
              contract: normalizeString(item.task.task_name) === "vet huu co"
                ? "153120"
                : formatNumber(item.contractQty),
              percent: item.contractQty > 0 ? ((item.totalActual / item.contractQty) * 100).toFixed(2) + "%" : "",
              to_date: item.to_date,
            });
          }
        });
      });
    });
    setAiResult(JSON.stringify(allTasksWithNote, null, 2));
  }

  return (
    <div className="p-4">
      <Head>
        <title>Báo cáo tuần và đánh giá</title>
      </Head>
      <h1 style={{ fontWeight: 800, fontSize: 40 }}>Báo cáo tuần và đánh giá</h1>
      <div style={{ marginBottom: 12 }}>
        <span>Từ ngày: </span>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <span style={{ marginLeft: 16 }}>Đến ngày: </span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
      </div>
      {error && (
        <div style={{ color: "red", fontWeight: 600 }}>{error}</div>
      )}
      {!error && weeklyReports.length === 0 && (
        <div>Không có dữ liệu báo cáo.</div>
      )}

      <div style={{ margin: "30px 0 40px 0" }}>
        <h2 style={{ fontWeight: 700, fontSize: 25, color: "#1a3b6b" }}>
          Tổng hợp tiến độ từng hạng mục/việc theo hợp đồng (theo từng tuyến/hạng mục)
        </h2>
        {Object.entries(grouped).map(([group, routes], i) => (
          <div key={group} style={{ marginBottom: 30 }}>
            <h3 style={{ fontWeight: 700, fontSize: 22, color: "#395989" }}>
              {i + 1}. {group}
            </h3>
            {Object.entries(routes).map(([route, tasks], j) => (
              <div key={route} style={{ marginBottom: 14 }}>
                <h4 style={{ fontWeight: 700, fontSize: 20, color: "#234b73" }}>
                  {String.fromCharCode(97 + j)}) {route}
                </h4>
                <table border={2} cellPadding={8} style={{ marginBottom: 12, minWidth: 900, background: "#fff" }}>
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Tên công việc (Hợp đồng)</th>
                      <th>Khối lượng hợp đồng</th>
                      <th>Tổng khối lượng thực hiện (tất cả tuần)</th>
                      <th>% Hoàn thành so với HĐ</th>
                      <th>Ghi chú tuần mới nhất</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(tasks).map((item, idx) => (
                      <tr key={item.task.task_name}>
                        <td>{idx + 1}</td>
                        <td>{item.task.task_name}</td>
                        <td>
                          {normalizeString(item.task.task_name) === "vet huu co"
                            ? "153120"
                            : formatNumber(item.contractQty)
                          }
                        </td>
                        <td>{formatNumber(item.totalActual)}</td>
                        <td>
                          {item.contractQty > 0
                            ? ((item.totalActual / (normalizeString(item.task.task_name) === "vet huu co" ? 153120 : item.contractQty)) * 100 > 200
                                ? <span style={{ color: "red", fontWeight: 600 }}>Quá lớn</span>
                                : ((item.totalActual / (normalizeString(item.task.task_name) === "vet huu co" ? 153120 : item.contractQty)) * 100).toFixed(2) + "%"
                              )
                            : ""}
                        </td>
                        <td>{item.note || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ))}
      </div>

      <button
        onClick={handleAIDanhGia}
        style={{
          padding: "10px 22px",
          borderRadius: 8,
          background: "#3166c1",
          color: "#fff",
          fontWeight: 700,
          fontSize: 18,
          marginBottom: 16,
        }}
      >
        Đánh giá AI các việc có ghi chú
      </button>
      {aiResult && (
        <pre
          style={{
            background: "#f7f7f9",
            border: "1px solid #d6d6d6",
            borderRadius: 6,
            padding: 14,
            marginTop: 6,
            maxHeight: 340,
            overflow: "auto",
          }}
        >
          {aiResult}
        </pre>
      )}
    </div>
  );
}
