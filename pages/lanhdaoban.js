import { useEffect, useState, useMemo } from "react";
import Head from "next/head";
import axios from "axios";

// --- Chuẩn hóa tên công việc để nhận diện "Vét hữu cơ"
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

function findProjectTask(subName, projectTasks) {
  const n1 = normalizeString(subName);
  if (!n1) return null;
  let found = projectTasks.find(pt => {
    const n2 = normalizeString(pt.task_name);
    return n1 === n2;
  });
  return found || null;
}

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

  // PHÂN NHÓM CHUẨN VIỆT NAM: chỉ lấy tuyến là số, không a), không "chưa rõ tuyến"
  const groupCodes = useMemo(() => [...new Set(weeklyReports.map(row => row.group_code).filter(Boolean))], [weeklyReports]);
  const groupNames = useMemo(() => {
    const names = {};
    weeklyReports.forEach(row => {
      if (row.group_code) names[row.group_code] = row.group_name || names[row.group_code] || "";
    });
    return names;
  }, [weeklyReports]);
  // Gom tuyến dạng số
  const groupedData = useMemo(() => {
    const data = {};
    weeklyReports.forEach(row => {
      const group_code = row.group_code || "";
      if (!group_code) return;
      let route = (row.group_sub_code || row.tuyen || row.tuyen_name || row.route || "").toString().trim();
      if (!/^\d+$/.test(route)) return; // Chỉ lấy tuyến là số nguyên dương
      if (!data[group_code]) data[group_code] = {};
      if (!data[group_code][route]) data[group_code][route] = [];
      // Chuẩn hóa số liệu hiển thị
      // Map đúng công việc từ hợp đồng nếu có
      const matched = findProjectTask(row.sub_name, projectTasks);
      let contractQty = "";
      if (matched) {
        contractQty = normalizeString(matched.task_name) === "vet huu co"
          ? "153120"
          : formatNumber(calcContractQuantity(matched.design_quantity, matched.unit || matched.donvi || matched.dvt));
      }
      data[group_code][route].push({
        ...row,
        contractQty,
        totalActual: formatNumber(row.thiet_ke ? parseFloat(row.thiet_ke) : 0),
        percent: contractQty && parseFloat(contractQty) > 0 && row.thiet_ke
          ? ((parseFloat(row.thiet_ke) / parseFloat(contractQty)) * 100 > 200
              ? "Quá lớn"
              : ((parseFloat(row.thiet_ke) / parseFloat(contractQty)) * 100).toFixed(2) + "%")
          : "",
      });
    });
    return data;
  }, [weeklyReports, projectTasks]);

  // Đánh giá AI
  function handleAIDanhGia() {
    // Gom báo cáo cùng nhóm, tuyến, công việc
    const allWorks = {};
    weeklyReports.forEach(row => {
      const matched = findProjectTask(row.sub_name, projectTasks);
      if (!matched) return;
      let group_code = row.group_code || "";
      let route = (row.group_sub_code || row.tuyen || row.tuyen_name || row.route || "").toString().trim();
      if (!/^\d+$/.test(route)) return;
      const taskKey = [group_code, route, normalizeString(matched.task_name)].join("|");
      if (!allWorks[taskKey]) allWorks[taskKey] = [];
      allWorks[taskKey].push({
        group_code,
        group_name: row.group_name,
        route,
        task_name: matched.task_name,
        date: row.to_date,
        actual: row.thiet_ke ? parseFloat(row.thiet_ke) : 0,
        note: row.note === "nan" ? "" : row.note,
      });
    });
    // Sort tuần mới nhất lên đầu
    Object.values(allWorks).forEach(list => list.sort((a, b) => (b.date < a.date ? 1 : -1)));

    let out = [];
    Object.values(allWorks).forEach(list => {
      if (list.length === 0) return;
      const cur = list[0];
      const prev = list[1];
      if (cur.note && cur.note.trim() !== "") {
        let chenhLech = "";
        if (prev) {
          if (cur.actual > prev.actual) chenhLech = `Khối lượng tuần này tăng so với tuần trước (${formatNumber(prev.actual)} ➔ ${formatNumber(cur.actual)}). `;
          else if (cur.actual < prev.actual) chenhLech = `Khối lượng tuần này giảm so với tuần trước (${formatNumber(prev.actual)} ➔ ${formatNumber(cur.actual)}). `;
          else chenhLech = `Khối lượng tuần này không đổi so với tuần trước (${formatNumber(cur.actual)}). `;
        } else {
          chenhLech = `Không có số liệu tuần trước để so sánh. `;
        }
        let xuLy = "";
        const ghiChu = cur.note.toLowerCase();
        if (ghiChu.includes("mưa")) xuLy = "Chỉ đạo: Chủ động máy bơm, che chắn, điều chỉnh tiến độ khi trời mưa.";
        else if (ghiChu.includes("thiếu vật liệu")) xuLy = "Chỉ đạo: Bổ sung vật liệu ngay, tránh ảnh hưởng tiến độ.";
        else if (ghiChu.includes("thiếu nhân lực")) xuLy = "Chỉ đạo: Bổ sung nhân lực, chia ca hợp lý.";
        else if (ghiChu.includes("mặt bằng") || ghiChu.includes("giải phóng mặt bằng")) xuLy = "Chỉ đạo: Đề nghị địa phương đẩy nhanh giải phóng mặt bằng.";
        else xuLy = "Chỉ đạo: Theo dõi, đề xuất biện pháp khắc phục phù hợp.";
        out.push(
          `- [${cur.group_name || cur.group_code || ""}] Tuyến ${cur.route}, ${cur.task_name}: ${chenhLech}Ghi chú: "${cur.note}". ${xuLy}`
        );
      }
    });
    if (out.length === 0) setAiText("Không có công việc nào có ghi chú để đánh giá.");
    else setAiText(out.join("\n\n"));
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
        {groupCodes.map((group_code, i) => (
          <div key={group_code} style={{ marginBottom: 30 }}>
            <h3 style={{ fontWeight: 700, fontSize: 32, color: "#395989" }}>
              {String.fromCharCode(73 + i)}. {groupNames[group_code] || group_code}
            </h3>
            {Object.keys(groupedData[group_code] || {}).sort((a,b)=>Number(a)-Number(b)).map((route, idx) => (
              <div key={route} style={{ marginBottom: 14 }}>
                <h4 style={{ fontWeight: 700, fontSize: 24, color: "#234b73" }}>
                  {idx + 1}. Tuyến {route}
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
                    {groupedData[group_code][route].map((item, tIdx) => (
                      <tr key={tIdx}>
                        <td>{tIdx + 1}</td>
                        <td>{item.sub_name || item.task_name}</td>
                        <td>{item.contractQty}</td>
                        <td>{item.totalActual}</td>
                        <td>{item.percent}</td>
                        <td>{item.note && item.note !== "nan" ? item.note : ""}</td>
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
