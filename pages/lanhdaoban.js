import { useEffect, useState } from "react";
import Head from "next/head";
import axios from "axios";

// Hàm đọc số và nhân hệ số đơn vị nếu có, chỉ lấy 2 số sau dấu thập phân
function parseVnNumber(val, unit = "") {
  if (typeof val === "number") return val;
  if (!val) return 0;
  let num = Number(val.toString().replace(/,/g, ""));
  if (isNaN(num)) return 0;
  // Nếu đơn vị dạng 100m3, 10m2, ... thì tách số và nhân
  if (unit) {
    const m = unit.match(/^(\d+)\s*(m3|m2|m|cái|bộ)?$/i);
    if (m) {
      num = num * Number(m[1]);
    }
  }
  return Number(num.toFixed(2));
}

// Dùng các hàm này đúng vị trí trong code cũ:
function calcContractQuantity(val, unit) {
  return parseVnNumber(val, unit);
}
function parseWeekValue(val, unit) {
  return parseVnNumber(val, unit);
}
function formatVnNumber(num) {
  if (typeof num !== "number") num = Number(num);
  if (isNaN(num)) return "";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


// --- Hàm cộng dồn khối lượng hợp đồng ---
function calcContractQuantity(val, unit) {
  let num = parseVnNumber(val);
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

// --- Hàm đọc số khối lượng thực hiện tuần ---
function parseWeekValue(val) {
  return parseVnNumber(val);
}

// --- Hàm chuẩn hóa tên công việc ---
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

// --- Đọc hệ số đơn vị ---
function getUnitFactor(unit) {
  if (!unit) return [1, ""];
  let m = unit.match(/^(\d+)\s*(m3|m2|m|cái|bộ)?$/i);
  if (m) return [Number(m[1]), (m[2] || "").toLowerCase()];
  let m2 = unit.match(/^(m3|m2|m|cái|bộ)$/i);
  if (m2) return [1, m2[1].toLowerCase()];
  return [1, unit.toLowerCase()];
}

// --- So khớp tên công việc và đơn vị ---
function matchTask(subName, subUnit, task, taskUnit) {
  if (normalizeString(subName) !== normalizeString(task)) return false;
  const [subFactor, subDonvi] = getUnitFactor(subUnit);
  const [taskFactor, taskDonvi] = getUnitFactor(taskUnit);
  return subDonvi === taskDonvi;
}

function findProjectTask(row, projectTasks) {
  const subName = row.sub_name;
  const subUnit = (row.unit || row.dvt || row.donvi || "").toLowerCase();
  return (
    projectTasks.find(
      (pt) =>
        matchTask(subName, subUnit, pt.task_name, (pt.unit || pt.dvt || pt.donvi || "").toLowerCase())
    ) || null
  );
}

function getTaskProgressByGroup(weeklyReports, projectTasks) {
  const result = {};
  for (const row of weeklyReports) {
    const group = row.group_name || row.group_code || "Nhóm khác";
    const subUnit = (row.unit || row.dvt || row.donvi || "").toLowerCase();
    const matched = findProjectTask(row, projectTasks);

    if (matched) {
      const taskKey = matched.task_name;
      const [taskFactor, taskDonvi] = getUnitFactor((matched.unit || matched.dvt || matched.donvi || "").toLowerCase());
      const [subFactor, subDonvi] = getUnitFactor(subUnit);

      if (!result[group]) result[group] = {};
      if (!result[group][taskKey]) {
        let contractQty = parseVnNumber(matched.design_quantity) * taskFactor;
        result[group][taskKey] = {
          task: matched,
          contractQty,
          totalActual: 0,
        };
      }

      // Nếu đơn vị khác hệ số, phải quy đổi
      let v = parseWeekValue(row.thiet_ke);
      // Nếu hợp đồng là 100m3, báo cáo là m3 => phải chia v cho 100 (so sánh số lượng nhóm), hoặc ngược lại thì nhân
      if (taskFactor !== subFactor && subFactor && taskFactor) {
        v = v * (subFactor / taskFactor);
      }
      if (!isNaN(v) && v > 0) {
        result[group][taskKey].totalActual += v;
      }
    }
  }
  Object.values(result).forEach(groupData => {
    Object.values(groupData).forEach(item => {
      if (!item.contractQty || isNaN(item.contractQty) || item.contractQty <= 0) {
        item.percent = "";
      } else {
        const per = (item.totalActual / item.contractQty) * 100;
        item.percent = per.toFixed(2);
      }
    });
  });
  return result;
}

function formatVnNumber(num) {
  if (typeof num !== "number") num = Number(num);
  if (isNaN(num)) return "";
  return num.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
                          ? <span style={{ color: "orange", fontWeight: 600 }}>{formatVnNumber(item.contractQty)} ⚠️</span>
                          : formatVnNumber(item.contractQty)
                        )
                      }
                    </td>
                    <td>
                      {isNaN(item.totalActual) || !item.totalActual ? "" : formatVnNumber(item.totalActual)}
                    </td>
                    <td>
                      {item.percent === "" ? "" :
                        Number(item.percent) > 200 ? (
                          <span style={{ color: "red", fontWeight: 600 }}>{item.percent}%</span>
                        ) : (
                          `${item.percent}%`
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {Object.values(groupData).some(item => item.contractQty < 1 && item.contractQty > 0) && (
              <div style={{ color: "orange", margin: "8px 0 0 8px" }}>
                ⚠️ Phát hiện khối lượng hợp đồng nhỏ bất thường, hãy kiểm tra lại số liệu!
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
