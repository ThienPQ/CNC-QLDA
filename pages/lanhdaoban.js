import { useEffect, useState } from "react";
import Head from "next/head";
import axios from "axios";

// Hàm chuyển mã số kỹ thuật về dạng chuẩn, ví dụ: K=0,9; K=0.90; K 90 => K90
function standardizeKcode(str) {
  if (!str) return "";
  // Chuẩn hóa các mã kiểu K=0,9 hoặc K=0.90 hoặc K 90 về K90
  return str.replace(/k[ =:]*0[.,]?9{1,2}/gi, "K90")
            .replace(/k[ =:]*0[.,]?95/gi, "K95")
            .replace(/k[ =:]*0[.,]?98/gi, "K98");
}

// Chuẩn hóa tên công việc
function normalizeString(str) {
  if (!str) return "";
  let s = standardizeKcode(str);
  s = s.toLowerCase();
  const dict = [
    { match: /đắp đất nền đường/gi, standard: "đắp nền" },
    { match: /đắp nền đường/gi, standard: "đắp nền" },
    { match: /đắp đất/gi, standard: "đắp nền" },
    { match: /nền đường/gi, standard: "nền" },
    { match: /bê tông nhựa mặt đường/gi, standard: "btn mặt đường" }
  ];
  dict.forEach(({ match, standard }) => { s = s.replace(match, standard); });
  s = s.replace(/[^a-z0-9 k]/g, " "); // bỏ ký tự lạ, giữ chữ/số/k/cách
  s = s.replace(/\s+/g, " ").trim();
  // Chỉ giữ lại số và chữ, gom hết "k 90", "k=0,9" thành "k90"
  s = s.replace(/k[\s=:]*90/gi, "k90")
       .replace(/k[\s=:]*95/gi, "k95")
       .replace(/k[\s=:]*98/gi, "k98");
  return s;
}

// Hàm tách key chính và mã kỹ thuật
function extractKeyInfo(name) {
  if (!name) return { keys: [], codes: [] };
  let s = normalizeString(name);
  const keyWords = ["cống", "hố ga", "ga", "đào", "đắp", "nền", "tuyến", "thoát nước", "cải tạo", "đá dăm", "cát", "đệm"];
  const keys = keyWords.filter(kw => s.includes(kw));
  let codes = [];
  // Lấy các mã k90, k95, k98, d600, d800
  codes = (s.match(/k90|k95|k98|d\d{3,4}/gi) || []).map(x => x.toUpperCase());
  return { keys, codes: [...new Set(codes)] };
}

// So khớp mềm
function findProjectTask(subName, projectTasks) {
  const n1 = normalizeString(subName);
  if (!n1) return null;
  const info1 = extractKeyInfo(subName);
  // Exact/contains hoặc key+code
  let found = projectTasks.find(pt => {
    const n2 = normalizeString(pt.task_name);
    if (n1 === n2 || n2.includes(n1) || n1.includes(n2)) return true;
    const info2 = extractKeyInfo(pt.task_name);
    if (info1.keys.some(k => info2.keys.includes(k)) &&
        info1.codes.some(c => info2.codes.includes(c))) return true;
    return false;
  });
  if (found) return found;
  // Similarity
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

// Similarity (Levenshtein)
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
  const result = {};
  for (const row of weeklyReports) {
    const matched = findProjectTask(row.sub_name, projectTasks);
    if (matched) {
      const key = matched.task_name;
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

  const progress = getTaskProgress(weeklyReports, projectTasks);

  // Đánh giá AI tổng hợp: chỉ hiện các công việc có ghi chú KHÁC rỗng và KHÁC "nan"
  function renderAIAssessment() {
    if (!weeklyReports.length) return <div>Không có dữ liệu.</div>;
    const result = Object.entries(grouped).map(([group_code, data], idx) => {
      const rows = data.details
        .filter(row =>
          row.note &&
          row.note.trim() !== "" &&
          row.note.trim().toLowerCase() !== "nan"
        )
        .map((row) => {
          const matched = findProjectTask(row.sub_name, projectTasks);
          let contractDesign = matched ? matched.design_quantity : "";
          let percentHD = "";
          let status = "";
          if (matched && matched.design_quantity && row.thiet_ke) {
            let actual = parseFloat(row.thiet_ke);
            let planned = parseFloat(matched.design_quantity);
            if (planned > 0) percentHD = ((actual / planned) * 100).toFixed(1);
            status = percentHD
              ? `${percentHD}% so với hợp đồng`
              : "Không xác định";
          } else {
            status = "Không có trong hợp đồng";
          }
          return (
            <div key={row.sub_code || row.sub_name}>
              + {row.sub_name}: {row.thiet_ke || 0} ({status})<br />
              <i style={{ color: "#1a3b6b" }}>Ghi chú: {row.note}</i>
            </div>
          );
        });
      if (rows.length === 0) return null;
      return (
        <div key={group_code} style={{ marginBottom: 8 }}>
          <div>
            <b>
              - {group_code} {data.group_name}:
            </b>
          </div>
          {rows}
        </div>
      );
    });
    if (result.filter(x => x).length === 0)
      return <div>Không có công việc nào có ghi chú.</div>;
    return <div>Đánh giá tổng hợp tự động: {result}</div>;
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

      {/* Đánh giá AI tổng hợp tự động */}
      <div
        style={{
          marginTop: 24,
          background: "#eaffea",
          padding: 18,
          borderRadius: 8,
        }}
      >
        <b style={{ fontSize: 22 }}>Đánh giá AI tổng hợp tự động:</b>
        <div style={{ marginTop: 6, fontFamily: "monospace" }}>
          {renderAIAssessment()}
        </div>
      </div>
    </div>
  );
}
