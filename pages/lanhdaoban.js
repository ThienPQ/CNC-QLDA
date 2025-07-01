// pages/lanhdaoban.js
import { useEffect, useState } from "react";
import Head from "next/head";
import axios from "axios";

// Bộ ánh xạ từ/cụm đồng nghĩa, tiêu chuẩn ngành (có thể bổ sung thêm)
const jobAliasDict = [
  { match: /độ chặt yêu cầu k[=\- ]?0[.,]?98/gi, standard: "K98" },
  { match: /k=0[.,]?98/gi, standard: "K98" },
  { match: /k98/gi, standard: "K98" },
  { match: /đắp đất nền đường/gi, standard: "đắp nền" },
  { match: /đắp đất/gi, standard: "đắp nền" },
  { match: /nền đường/gi, standard: "nền" },
  { match: /bê tông nhựa mặt đường/gi, standard: "BTN mặt đường" },
  // ... bổ sung thêm tùy ngành của bạn
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
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  stopWords.forEach((sw) => {
    s = s.replace(new RegExp(`\\b${sw}\\b`, "g"), "");
  });
  return s.replace(/\s+/g, " ").trim();
}

// Tính similarity đơn giản (Levenshtein distance)
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

// Tìm công việc hợp đồng gần giống nhất
function findProjectTask(subName, projectTasks) {
  const n1 = normalizeString(subName);
  if (!n1) return null;
  // 1. Exact or contains match
  let found = projectTasks.find(pt => {
    const n2 = normalizeString(pt.task_name);
    return n1 === n2 || n2.includes(n1) || n1.includes(n2);
  });
  if (found) return found;

  // 2. Similarity matching
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
  // NGƯỠNG SIMILARITY ở đây (ví dụ 0.2 là 20%)
  if (best && bestScore > 0.2) return best;
  return null;
}

export default function LanhDaoBan() {
  const [weeklyReports, setWeeklyReports] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Tự động chọn tuần mới nhất
    async function fetchWeeklyReportsAndSetDefaultDates() {
      try {
        const res = await axios.get("/api/get-weekly-reports");
        const data = res.data || [];
        setWeeklyReports(data);

        // Tìm tuần mới nhất
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
    // Lấy dữ liệu hợp đồng
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

  // Khi thay đổi khoảng thời gian, fetch lại dữ liệu báo cáo tuần
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

  // Gom nhóm theo hạng mục cha (group_code/group_name)
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

  // Đánh giá AI tổng hợp tự động: chỉ hiện các công việc có ghi chú
  // Đánh giá AI tổng hợp tự động: chỉ hiện các công việc có ghi chú KHÁC rỗng và KHÁC "nan"
function renderAIAssessment() {
  if (!weeklyReports.length) return <div>Không có dữ liệu.</div>;

  // Gom nhóm và tạo đánh giá cho từng nhóm cha
  const result = Object.entries(grouped).map(([group_code, data], idx) => {
    // Chỉ hiện công việc có ghi chú KHÁC rỗng và KHÁC "nan"
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
          // Tính phần trăm hoàn thành so với hợp đồng
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


    // Chỉ hiện nếu có ít nhất một đánh giá có ghi chú
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

      {/* Hiển thị từng hạng mục cha */}
      {Object.entries(grouped).map(([group_code, data]) => (
        <div key={group_code} style={{ marginBottom: 28 }}>
          <h2 style={{ fontWeight: 700, fontSize: 30 }}>
            {group_code} - {data.group_name}
          </h2>
          {/* Với mỗi nhóm con */}
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
                  <th>Thiết kế (hợp đồng)</th>
                  <th>% Hoàn thành so với HĐ</th>
                  <th>Ghi chú</th>
                  <th>So khớp hợp đồng</th>
                </tr>
              </thead>
              <tbody>
                {data.details.map((row, idx) => {
                  const matched = findProjectTask(row.sub_name, projectTasks);
                  const contractDesign = matched
                    ? matched.design_quantity
                    : "Không có trong hợp đồng";
                  let percentHD = "";
                  if (
                    matched &&
                    matched.design_quantity &&
                    row.thiet_ke &&
                    !isNaN(parseFloat(row.thiet_ke)) &&
                    !isNaN(parseFloat(matched.design_quantity))
                  ) {
                    const actual = parseFloat(row.thiet_ke);
                    const planned = parseFloat(matched.design_quantity);
                    if (planned > 0)
                      percentHD = ((actual / planned) * 100).toFixed(1) + "%";
                  }
                  return (
                    <tr key={row.sub_code || row.sub_name}>
                      <td>{idx + 1}</td>
                      <td>{row.sub_name}</td>
                      <td>{row.ly_trinh}</td>
                      <td>{row.unit}</td>
                      <td>{row.thiet_ke}</td>
                      <td>{contractDesign}</td>
                      <td>
                        {percentHD ||
                          (contractDesign === "Không có trong hợp đồng"
                            ? ""
                            : "Không xác định")}
                      </td>
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
