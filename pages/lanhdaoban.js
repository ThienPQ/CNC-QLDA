import { useEffect, useState } from "react";
import Head from "next/head";
import axios from "axios";

// Chuẩn hóa tên công việc
function normalizeString(str) {
  if (!str) return "";
  let s = str
    .replace(/[\n\r\t"';,]+/g, " ")
    .replace(/K[= :]*0[.,]?90?\b/gi, "K90")
    .replace(/K[= :]*0[.,]?95\b/gi, "K95")
    .replace(/K[= :]*0[.,]?98\b/gi, "K98");
  s = s.replace(/đắp đất nền đường/gi, "đắp nền");
  s = s.replace(/độ chặt yêu cầu/gi, "");
  s = s.replace(/đắp đất/gi, "đắp nền");
  s = s.replace(/[^a-zA-Z0-9 ]/g, " ");
  s = s.toLowerCase().replace(/\s+/g, " ").trim();
  return s;
}

// CHUẨN HÓA SỐ KHỐI LƯỢNG HỢP ĐỒNG (loại . và ,)
function calcContractQuantity(design_quantity, unit) {
  if (!design_quantity) return 0;
  // Loại bỏ mọi dấu . và , để không bị mất số không!
  let numStr = String(design_quantity).replace(/[.,]/g, "");
  let num = Number(numStr);
  if (!unit) return num;

  // Tìm xem unit có dạng "100m3", "100m2", "100m"
  let match = unit.match(/^(\d+)\s*(m3|m2|m)$/i);
  if (match) {
    let factor = Number(match[1]);
    if (!isNaN(factor)) {
      return num * factor;
    }
  }
  return num;
}

// So khớp công việc hợp đồng
function findProjectTask(subName, projectTasks) {
  const n1 = normalizeString(subName);
  if (!n1) return null;
  let found = projectTasks.find(pt => {
    const n2 = normalizeString(pt.task_name);
    return n1 === n2;
  });
  if (found) return found;
  let foundSoft = projectTasks.find(pt => {
    const n2 = normalizeString(pt.task_name);
    return n2.includes(n1) || n1.includes(n2);
  });
  if (foundSoft) return foundSoft;
  let best = null, bestScore = 0.0;
  for (let pt of projectTasks) {
    const n2 = normalizeString(pt.task_name);
    let score = similarity(n1, n2);
    if (score > bestScore) {
      bestScore = score;
      best = pt;
    }
  }
  if (best && bestScore > 0.2) return best;
  return null;
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  let longer = a.length > b.length ? a : b;
  let shorter = a.length > b.length ? b : a;
  let longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  let editDistance = (s1, s2) => {
    let costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) costs[j] = j;
        else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  };
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

// Tổng hợp tiến độ cho từng tuyến/hạng mục riêng biệt
function getTaskProgressByGroup(weeklyReports, projectTasks) {
  const result = {};
  for (const row of weeklyReports) {
    const group = row.group_name || row.group_code || "Nhóm khác";
    const matched = findProjectTask(row.sub_name, projectTasks);
    if (matched) {
      const taskKey = matched.task_name;
      if (!result[group]) result[group] = {};
      if (!result[group][taskKey]) {
        result[group][taskKey] = {
          task: matched,
          totalActual: 0,
          contractQty: calcContractQuantity(
            matched.design_quantity,
            matched.unit || matched.donvi || matched.dvt // sửa đúng tên cột đơn vị của bạn nếu khác
          ),
          listRows: [],
        };
      }
      const v = parseFloat(row.thiet_ke);
      if (!isNaN(v) && v > 0) {
        result[group][taskKey].totalActual += v;
        result[group][taskKey].listRows.push(row);
      }
    }
  }
  Object.values(result).forEach(groupData => {
    Object.values(groupData).forEach(item => {
      if (!item.contractQty || isNaN(item.contractQty) || item.contractQty <= 0) {
        item.percent = "";
      } else {
        const per = (item.totalActual / item.contractQty) * 100;
        item.percent = per > 200 ? ">200" : per.toFixed(1);
      }
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

  const grouped = {};
  for (const row of weeklyReports) {
    if (!grouped[row.group_code]) {
      grouped[row.group_code] = {
        group_name: row.group_name,
        details: [],
      };
    }
    grouped[row.group_code].details.push(row);
  }

  const progressByGroup = getTaskProgressByGroup(weeklyReports, projectTasks);

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
        {Object.entries(progressByGroup).map(([groupName, groupData], i) => (
          <div key={groupName} style={{ marginBottom: 30 }}>
            <h3 style={{ fontWeight: 700, fontSize: 22, color: "#395989" }}>
              {i + 1}. {groupName}
            </h3>
            <table border={2} cellPadding={8} style={{ marginBottom: 12, minWidth: 900, background: "#fff" }}>
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Tên công việc (Hợp đồng)</th>
                  <th>Khối lượng hợp đồng</th>
                  <th>Tổng khối lượng thực hiện (tất cả tuần)</th>
                  <th>% Hoàn thành so với HĐ</th>
                  <th>Các báo cáo thực tế (công việc tương ứng)</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(groupData).map((item, idx) => (
                  <tr key={item.task.task_name}>
                    <td>{idx + 1}</td>
                    <td>{item.task.task_name}</td>
                    <td>
                      {(isNaN(item.contractQty) || !item.contractQty)
                        ? ""
                        : (item.contractQty < 1
                          ? <span style={{ color: "orange", fontWeight: 600 }}>{item.contractQty} ⚠️</span>
                          : item.contractQty
                        )
                      }
                    </td>
                    <td>
                      {isNaN(item.totalActual) || !item.totalActual ? "" : item.totalActual}
                    </td>
                    <td>
                      {item.percent === "" ? "" :
                        item.percent === ">200" ? (
                          <span style={{ color: "red", fontWeight: 600 }}>Quá lớn</span>
                        ) : (
                          `${item.percent}%`
                        )}
                    </td>
                    <td>
                      {item.listRows.map(r =>
                        <div key={r.sub_name + r.group_code}>
                          <b>{r.group_name}:</b> {r.sub_name} ({r.thiet_ke})
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Cảnh báo nếu có khối lượng hợp đồng nhỏ bất thường */}
            {Object.values(groupData).some(item => item.contractQty < 1 && item.contractQty > 0) && (
              <div style={{ color: "orange", margin: "8px 0 0 8px" }}>
                ⚠️ Phát hiện khối lượng hợp đồng nhỏ bất thường, hãy kiểm tra lại số liệu!
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Phần chi tiết báo cáo từng nhóm vẫn giữ nguyên */}
      {Object.entries(grouped).map(([group_code, data]) => (
        <div key={group_code} style={{ marginBottom: 28 }}>
          <h2 style={{ fontWeight: 700, fontSize: 30 }}>
            {group_code} - {data.group_name}
          </h2>
          {data.details.length > 0 && (
            <table
              border={2}
              cellPadding={8}
              style={{ marginBottom: 12, minWidth: 900, background: "#fff" }}
            >
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Tên công việc</th>
                  <th>Lý trình</th>
                  <th>Đơn vị</th>
                  <th>Thiết kế (báo cáo tuần)</th>
                  <th>Ghi chú</th>
                  <th>So khớp hợp đồng</th>
                </tr>
              </thead>
              <tbody>
                {data.details.map((row, idx) => {
                  const matched = findProjectTask(row.sub_name, projectTasks);
                  return (
                    <tr key={row.sub_code || row.sub_name}>
                      <td>{idx + 1}</td>
                      <td>{row.sub_name}</td>
                      <td>{row.ly_trinh}</td>
                      <td>{row.unit}</td>
                      <td>{row.thiet_ke}</td>
                      <td>{row.note}</td>
                      <td>
                        {matched
                          ? "Khớp công việc hợp đồng"
                          : "Không khớp công việc hợp đồng"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
