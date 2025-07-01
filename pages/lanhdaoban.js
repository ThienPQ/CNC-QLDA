// pages/lanhdaoban.js
import { useEffect, useState } from "react";
import Head from "next/head";
import axios from "axios";

// Bộ từ điển chuẩn hóa đồng nghĩa
const jobAliasDict = [
  { match: /độ chặt yêu cầu k[=\- ]?0[.,]?98/gi, standard: "K98" },
  { match: /k=0[.,]?98/gi, standard: "K98" },
  { match: /k98/gi, standard: "K98" },
  { match: /đắp đất nền đường/gi, standard: "đắp nền" },
  { match: /đắp đất/gi, standard: "đắp nền" },
  { match: /nền đường/gi, standard: "nền" },
  { match: /bê tông nhựa mặt đường/gi, standard: "btn mặt đường" },
  { match: /thi công lớp/gi, standard: "" },
  { match: /thi công/gi, standard: "" },
  // ... bổ sung thêm nếu muốn
];

function normalizeString(str) {
  if (!str) return "";
  let s = str.toLowerCase();
  jobAliasDict.forEach(({ match, standard }) => {
    s = s.replace(match, standard);
  });
  // Loại stopword và ký tự đặc biệt
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

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1.0;
  const matrix = [];
  let i;
  for (i = 0; i <= b.length; i++) { matrix[i] = [i]; }
  let j;
  for (j = 0; j <= a.length; j++) { matrix[0][j] = j; }
  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return 1 - matrix[b.length][a.length] / Math.max(a.length, b.length);
}

// Tìm công việc hợp đồng gần giống nhất
function findProjectTask(subName, projectTasks) {
  const n1 = normalizeString(subName);
  if (!n1) return null;
  // Exact or contains
  let found = projectTasks.find(pt => {
    const n2 = normalizeString(pt.task_name);
    return n1 === n2 || n2.includes(n1) || n1.includes(n2);
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
  if (best && bestScore > 0.7) return best; // 0.7 là ngưỡng, chỉnh nếu cần
  return null;
}

function generateAIReportSummary(latest, prev, projectTasks) {
  if (!latest || latest.length === 0) return "Không có dữ liệu tuần mới nhất.";
  let summary = [];
  const groupMap = {};
  latest.forEach(task => {
    const groupKey = `${task.group_code} - ${task.group_name}`;
    if (!groupMap[groupKey]) groupMap[groupKey] = [];
    groupMap[groupKey].push(task);
  });

  for (const group in groupMap) {
    summary.push(`**${group}**`);
    groupMap[group].forEach(task => {
      const prevTask = prev ? prev.find(t => t.sub_code === task.sub_code) : null;
      let change = "";
      if (prevTask) {
        const diff = (parseFloat(task.percent_week) || 0) - (parseFloat(prevTask.percent_week) || 0);
        change = diff > 0
          ? `Tăng ${diff.toFixed(2)}% so với tuần trước`
          : diff < 0
            ? `Giảm ${Math.abs(diff).toFixed(2)}% so với tuần trước`
            : "Không thay đổi so với tuần trước";
      }
      const projTask = findProjectTask(task.sub_name, projectTasks);
      const percentHD = projTask?.percent || task.percent_duan || "";
      summary.push(
        `- ${task.sub_code} ${task.sub_name}: Tuần này hoàn thành ${task.percent_week}% (${change}). Tổng lũy kế: ${task.percent_duan || 0}% so với hợp đồng (${percentHD}%)${task.note ? `. Ghi chú: ${task.note}` : ""}`
      );
    });
  }
  return summary.join("\n");
}

export default function LanhDaoBan() {
  const [weeklyReports, setWeeklyReports] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [res1, res2] = await Promise.all([
          axios.get("/api/get-weekly-reports"),
          axios.get("/api/get-project-tasks"),
        ]);
        setWeeklyReports(res1.data || []);
        setProjectTasks(res2.data || []);
        setError(null);
      } catch (err) {
        setError("Không thể tải dữ liệu báo cáo.");
      }
    }
    fetchData();
  }, []);

  // Nhóm các tuần
  const weekGroups = {};
  weeklyReports.forEach(r => {
    const key = r.to_date;
    if (!weekGroups[key]) weekGroups[key] = [];
    weekGroups[key].push(r);
  });
  const weekDates = Object.keys(weekGroups).sort(); // tăng dần
  const latestWeek = weekGroups[weekDates[weekDates.length-1]];
  const prevWeek = weekGroups[weekDates[weekDates.length-2]];

  // Gộp cộng dồn số liệu theo công việc (sub_code), lấy giá trị mới nhất
  function groupReports(reports) {
    if (!reports) return {};
    const result = {};
    reports.forEach(r => {
      if (!result[r.group_code]) result[r.group_code] = { group_name: r.group_name, tasks: {} };
      if (!result[r.group_code].tasks[r.sub_code]) result[r.group_code].tasks[r.sub_code] = { ...r };
      else {
        result[r.group_code].tasks[r.sub_code] = {
          ...r,
          percent_week: (parseFloat(result[r.group_code].tasks[r.sub_code].percent_week || 0) + parseFloat(r.percent_week || 0)).toString(),
          percent_duan: Math.max(parseFloat(result[r.group_code].tasks[r.sub_code].percent_duan || 0), parseFloat(r.percent_duan || 0)).toString(),
        };
      }
    });
    return result;
  }
  const grouped = groupReports(latestWeek);

  // Đánh giá AI tự động giữa tuần mới nhất và trước đó
  const aiSummary = generateAIReportSummary(latestWeek, prevWeek, projectTasks);

  return (
    <div className="p-4">
      <Head>
        <title>Báo cáo tuần và đánh giá</title>
      </Head>
      <h1 className="text-2xl font-bold mb-4">Báo cáo tuần và đánh giá</h1>
      {error && <p className="text-red-500">{error}</p>}
      {Object.keys(grouped).length === 0 ? (
        <p>Không có dữ liệu báo cáo.</p>
      ) : (
        Object.entries(grouped).map(([groupCode, data], groupIndex) => (
          <div key={groupIndex} className="mb-6">
            <h2 className="text-lg font-semibold mb-2">
              Hạng mục {groupCode}: {data.group_name}
            </h2>
            <table className="w-full border-collapse border border-gray-300 mb-2">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1">Nhóm CV</th>
                  <th className="border border-gray-300 px-2 py-1">Tên công việc</th>
                  <th className="border border-gray-300 px-2 py-1">Lý trình</th>
                  <th className="border border-gray-300 px-2 py-1">Đơn vị</th>
                  <th className="border border-gray-300 px-2 py-1">Thiết kế</th>
                  <th className="border border-gray-300 px-2 py-1">% hoàn thành tuần</th>
                  <th className="border border-gray-300 px-2 py-1">% hoàn thành dự án</th>
                  <th className="border border-gray-300 px-2 py-1">% HĐ</th>
                  <th className="border border-gray-300 px-2 py-1">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(data.tasks).map((task, i) => {
                  const projTask = findProjectTask(task.sub_name, projectTasks);
                  const percentHD = projTask?.percent || "";
                  return (
                    <tr key={i}>
                      <td className="border border-gray-300 px-2 py-1">{task.sub_code}</td>
                      <td className="border border-gray-300 px-2 py-1">{task.sub_name}</td>
                      <td className="border border-gray-300 px-2 py-1">{task.ly_trinh}</td>
                      <td className="border border-gray-300 px-2 py-1">{task.unit}</td>
                      <td className="border border-gray-300 px-2 py-1">{task.thiet_ke}</td>
                      <td className="border border-gray-300 px-2 py-1">{task.percent_week}</td>
                      <td className="border border-gray-300 px-2 py-1">{task.percent_duan}</td>
                      <td className="border border-gray-300 px-2 py-1">{percentHD}</td>
                      <td className="border border-gray-300 px-2 py-1">{task.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
      <div className="mt-4 p-4 bg-gray-50 border rounded text-base whitespace-pre-line">
        <b>Đánh giá AI tự động:</b>
        <br />
        {aiSummary}
      </div>
    </div>
  );
}
