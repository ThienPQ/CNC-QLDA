import { useEffect, useState } from "react";
import Head from "next/head";
import axios from "axios";

// Ánh xạ và chuẩn hóa tên việc (như các bản trước, bổ sung thêm)
const jobAliasDict = [
  { match: /k[= ]?0[.,]?90/gi, standard: "K90" },
  { match: /k=0[.,]?9/gi, standard: "K90" },
  { match: /k90/gi, standard: "K90" },
  { match: /đắp nền k90/gi, standard: "đắp nền K90" },
  { match: /đắp nền/gi, standard: "đắp nền" },
  // Thêm các mẫu khác nếu cần
];

function normalizeString(str) {
  if (!str) return "";
  let s = str.toLowerCase();
  jobAliasDict.forEach(({ match, standard }) => {
    s = s.replace(match, standard);
  });
  const stopWords = [
    "thi cong", "hang muc", "cong viec", "duong", "cau", "nut giao", "tuyen",
    "bao cao", "hop dong", "cong trinh", "khoi luong", "bo sung", "nhua mat",
    "dat", "lop", "xay dung", "thiet ke"
  ];
  s = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  stopWords.forEach((sw) => {
    s = s.replace(new RegExp(`\\b${sw}\\b`, "g"), "");
  });
  return s.replace(/\s+/g, " ").trim();
}

// Tách key, code phục vụ mapping mềm
function extractKeyInfo(name) {
  if (!name) return { keys: [], codes: [] };
  let s = name.toLowerCase();
  const keyWords = ["cống", "hố ga", "ga", "đào", "đắp", "nền", "tuyến", "thoát nước", "cải tạo", "đá dăm", "cát", "đệm"];
  const keys = keyWords.filter(kw => s.includes(kw));
  let codes = [];
  const codeReg = /[dk][ =]?\.?\d{1,4}/gi;
  let match;
  while ((match = codeReg.exec(s))) {
    codes.push(match[0].replace(/[^a-z0-9]/gi, "").toUpperCase());
  }
  const extra = s.match(/d\d{3,4}/gi) || [];
  codes.push(...extra.map(x => x.toUpperCase()));
  return { keys, codes: [...new Set(codes)] };
}

// Matching
function findProjectTask(subName, projectTasks) {
  const n1 = normalizeString(subName);
  if (!n1) return null;
  const info1 = extractKeyInfo(subName);

  // Exact/contains hoặc ghép mềm theo key+code
  let found = projectTasks.find(pt => {
    const n2 = normalizeString(pt.task_name);
    if (n1 === n2 || n2.includes(n1) || n1.includes(n2)) return true;
    const info2 = extractKeyInfo(pt.task_name);
    if (info1.keys.some(k => info2.keys.includes(k)) &&
        info1.codes.some(c => info2.codes.includes(c))) return true;
    return false;
  });
  if (found) return found;

  // Similarity matching
  let best = null;
  let bestScore = 0.0;
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

// Similarity như trước
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

// Tổng khối lượng thực hiện theo task mapping toàn hệ thống
function getTaskProgress(weeklyReports, projectTasks) {
  // Kết quả: {taskId: {task, totalActual, contractQty, percent, listRows: []}}
  const result = {};

  for (const row of weeklyReports) {
    const matched = findProjectTask(row.sub_name, projectTasks);
    if (matched) {
      const key = matched.task_name; // có thể dùng task_code nếu cần
      if (!result[key]) {
        result[key] = {
          task: matched,
          totalActual: 0,
          contractQty: parseFloat(matched.design_quantity || 0),
          listRows: [],
        };
      }
      result[key].totalActual += parseFloat(row.thiet_ke || 0);
      result[key].listRows.push(row);
    }
  }

  // Tính phần trăm hoàn thành
  Object.values(result).forEach(item => {
    item.percent = item.contractQty > 0 ? ((item.totalActual / item.contractQty) * 100).toFixed(1) : "";
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

  // Gom nhóm theo group_code
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

  // Tổng hợp tiến độ theo task mapping toàn hệ thống
  const progress = getTaskProgress(weeklyReports, projectTasks);

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

      {/* Bảng tổng hợp tiến độ theo từng công việc mapping hợp đồng */}
      <div style={{ margin: "30px 0 40px 0" }}>
        <h2 style={{ fontWeight: 700, fontSize: 25, color: "#1a3b6b" }}>
          Tổng hợp tiến độ từng hạng mục/việc theo hợp đồng
        </h2>
        <table border={2} cellPadding={8} style={{ marginBottom: 12, minWidth: 900, background: "#fff" }}>
          <thead>
            <tr>
              <th>STT</th>
              <th>Tên công việc (Hợp đồng)</th>
              <th>Khối lượng hợp đồng</th>
              <th>Tổng khối lượng thực hiện (tất cả tuần)</th>
              <th>% Hoàn thành so với HĐ</th>
              <th>Nhóm báo cáo thực tế (các tuyến/hạng mục)</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(progress).map((item, idx) => (
              <tr key={item.task.task_name}>
                <td>{idx + 1}</td>
                <td>{item.task.task_name}</td>
                <td>{item.contractQty}</td>
                <td>{item.totalActual}</td>
                <td>{item.percent ? `${item.percent}%` : ""}</td>
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
      </div>

      {/* Hiển thị từng nhóm cha (tuyến/hạng mục) chi tiết */}
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
