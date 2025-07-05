import { useEffect, useState } from "react";
import Head from "next/head";
import axios from "axios";

// Chuẩn hóa tên công việc (để nhận diện "Vét hữu cơ")
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

function parseVnContractNumber(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  if (/^\d+\.\d{3}$/.test(val)) return Number(val.replace(/\./, ""));
  if (/^\d+\.\d{2}$/.test(val)) return Number(val.replace(/\./, "") + "0");
  if (/^\d+\.\d+$/.test(val)) {
    const arr = val.split(".");
    if (arr[1].length === 3) return Number(arr[0] + arr[1]);
    if (arr[1].length === 2) return Number(arr[0] + arr[1] + "0");
    return Number(arr.join(""));
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(val)) return Number(val.replace(/\./g, ""));
  return Number(val);
}

function formatNumber(num) {
  if (typeof num !== "number") num = Number(num);
  if (isNaN(num)) return "";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Ghép các tuần báo cáo cho 1 công việc
function groupBySectionAndRouteAllWeeks(weeklyReports, projectTasks) {
  // Gom tất cả báo cáo cùng tên công việc + tuyến + hạng mục
  const key = (row, matched) =>
    [
      row.group_code || "",
      row.group_sub_code || row.tuyen || row.tuyen_name || row.sub_group || row.route || "",
      normalizeString(matched ? matched.task_name : row.sub_name),
    ].join("|");
  const all = {};
  for (const row of weeklyReports) {
    const matched = findProjectTask(row.sub_name, projectTasks);
    if (!matched) continue;
    const k = key(row, matched);
    if (!all[k]) all[k] = [];
    all[k].push({
      group_code: row.group_code,
      group_name: row.group_name,
      route: row.group_sub_code || row.tuyen || row.tuyen_name || row.sub_group || row.route || "",
      task_name: matched.task_name,
      date: row.to_date,
      week: row.week,
      actual: row.thiet_ke ? parseFloat(row.thiet_ke) : 0,
      note: row.note === "nan" ? "" : row.note,
    });
  }
  // Sort tuần mới nhất lên đầu
  Object.values(all).forEach(list => list.sort((a, b) => (b.date > a.date ? 1 : -1)));
  return all;
}

function findProjectTask(subName, projectTasks) {
  const n1 = normalizeString(subName);
  if (!n1) return null;
  let found = projectTasks.find(pt => {
    const n2 = normalizeString(pt.task_name);
    return n1 === n2;
  });
  return found || null;
}

export default function LanhDaoBan() {
  const [weeklyReports, setWeeklyReports] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState("");
  const [aiText, setAiText] = useState("");

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

  // Gom báo cáo cùng nhóm, tuyến, công việc
  const allWorks = groupBySectionAndRouteAllWeeks(weeklyReports, projectTasks);

  // Nhận diện ghi chú tuần mới nhất
  function handleAIDanhGia() {
    let out = [];
    Object.values(allWorks).forEach(list => {
      if (list.length === 0) return;
      const cur = list[0];
      // Lấy tuần trước đó (nếu có)
      const prev = list[1];
      if (cur.note && cur.note.trim() !== "") {
        let chenhLech = "";
        if (prev) {
          if (cur.actual > prev.actual) chenhLech = `Khối lượng tuần này tăng so với tuần trước (${formatNumber(prev.actual)} ➔ ${formatNumber(cur.actual)}). `;
          else if (cur.actual < prev.actual) chenhLech = `Khối lượng tuần này giảm so với tuần trước (${formatNumber(prev.actual)} ➔ ${formatNumber(cur.actual)}). `;
          else chenhLech = `Khối lượng tuần này không đổi so với tuần trước (${formatNumber(cur.actual)}). `;
        } else {
          chenhLech = `Không có số liệu tuần trước để so sánh.`;
        }
        // Đưa ra nhận xét và chỉ đạo
        let xuLy = "";
        const ghiChu = cur.note.toLowerCase();
        if (ghiChu.includes("mưa")) xuLy = "Chỉ đạo: Chủ động máy bơm, bố trí che chắn, điều chỉnh tiến độ phù hợp khi trời mưa.";
        else if (ghiChu.includes("thiếu vật liệu")) xuLy = "Chỉ đạo: Yêu cầu nhà thầu bổ sung vật liệu kịp thời, tránh ảnh hưởng tiến độ.";
        else if (ghiChu.includes("thiếu nhân lực")) xuLy = "Chỉ đạo: Bổ sung nhân lực, chia ca hợp lý để đẩy nhanh tiến độ.";
        else if (ghiChu.includes("mặt bằng") || ghiChu.includes("giải phóng mặt bằng")) xuLy = "Chỉ đạo: Đề nghị địa phương hỗ trợ đẩy nhanh giải phóng mặt bằng.";
        else xuLy = "Chỉ đạo: Theo dõi sát, đề xuất biện pháp khắc phục phù hợp.";

        out.push(
          `- [${cur.group_name || cur.group_code || ""}] ${cur.route ? "Tuyến " + cur.route + ", " : ""}${cur.task_name}: ${chenhLech}Ghi chú: "${cur.note}". ${xuLy}`
        );
      }
    });
    if (out.length === 0) {
      setAiText("Không có công việc nào có ghi chú để đánh giá.");
    } else {
      setAiText(out.join("\n\n"));
    }
  }

  // Phần giao diện bảng báo cáo như trước (không đổi)
  // ... copy lại giao diện bảng báo cáo như các code trước ...
  // (bạn có thể copy phần bảng đã dùng, không ảnh hưởng logic đánh giá AI)

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

      {/* ... bảng tổng hợp tiến độ từng hạng mục/việc như cũ ... */}

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
      {aiText && (
        <div style={{
          background: "#fafafd",
          padding: 18,
          borderRadius: 7,
          border: "1px solid #e1e1e8",
          marginBottom: 30,
          whiteSpace: "pre-line",
          fontSize: 17,
          color: "#174580"
        }}>
          <h3 style={{ color: "#285ea6", marginTop: 0, fontWeight: 700 }}>Đánh giá AI các công việc có ghi chú</h3>
          {aiText}
        </div>
      )}
    </div>
  );
}
