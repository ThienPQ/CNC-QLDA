import { useEffect, useState } from "react";
import Head from "next/head";
import axios from "axios";

// ======= Các hàm chuẩn số, tên =======
function parseVnNumber(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  let num = Number(val.toString().replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
}
function getUnitFactor(unit) {
  if (!unit) return [1, ""];
  let m = unit.match(/^(\d+)\s*(m3|m2|m|cái|bộ)?$/i);
  if (m) return [Number(m[1]), (m[2] || "").toLowerCase()];
  let m2 = unit.match(/^(m3|m2|m|cái|bộ)$/i);
  if (m2) return [1, m2[1].toLowerCase()];
  return [1, unit.toLowerCase()];
}
function calcContractQuantity(val, unit) {
  let num = parseVnNumber(val);
  const [factor] = getUnitFactor(unit);
  return num * factor;
}
function parseWeekValue(val, unit) {
  let num = parseVnNumber(val);
  const [factor] = getUnitFactor(unit);
  return num * factor;
}
function formatVnNumber(num) {
  if (typeof num !== "number") num = Number(num);
  if (isNaN(num)) return "";
  return num.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
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

// ==== Gom nhóm lớn ====
function getGroupDisplayName(groupName) {
  const n = (groupName || "").toLowerCase();
  if (n.includes("giao thông") || n.match(/^tuyến|^nút giao/)) return "Giao thông";
  if (n.includes("thoát nước")) return "Thoát nước mưa";
  if (n.includes("nội khu")) return "Tuyến nội khu";
  if (n.includes("tuyến số 2")) return "Tuyến số 2";
  if (n.includes("chính ct")) return "Tuyến chính CT";
  if (n.includes("cải tạo")) return "Tuyến cải tạo";
  return groupName || "Khác";
}
function groupWeeklyByBigGroup(weeklyReports) {
  const result = {};
  weeklyReports.forEach(row => {
    const groupBig = getGroupDisplayName(row.group_name || "");
    if (!result[groupBig]) result[groupBig] = [];
    result[groupBig].push(row);
  });
  return result;
}

import React from "react";
export default function LanhDaoBan() {
  const [weeklyReports, setWeeklyReports] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState("");
  const [aiResponses, setAiResponses] = useState({});

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

  // Hàm gọi API lấy ý kiến AI cho từng ghi chú
  async function fetchAiSuggestion({ taskName, actualQty, contractQty, note }, idx) {
    setAiResponses(r => ({ ...r, [idx]: "Đang lấy ý kiến AI..." }));
    const prompt = `
Tên công việc: ${taskName}
Khối lượng tuần: ${actualQty}
Khối lượng hợp đồng: ${contractQty}
Ghi chú: ${note}

Với nội dung thế này thì lãnh đạo phải chỉ đạo gì để đẩy nhanh tiến độ, tháo gỡ khó khăn vướng mắc việc này? (Trả lời ngắn gọn, súc tích bằng tiếng Việt.)
    `.trim();
    try {
      const res = await axios.post("/api/ask-gpt", { prompt });
      setAiResponses(r => ({ ...r, [idx]: res.data.answer }));
    } catch {
      setAiResponses(r => ({ ...r, [idx]: "Không thể lấy ý kiến AI, thử lại sau!" }));
    }
  }

  // Tìm tuần báo cáo mới nhất để mặc định lọc
  const latestToDate = weeklyReports.reduce((max, row) => {
    if (row.to_date && (!max || row.to_date > max)) return row.to_date;
    return max;
  }, "");
  // Dữ liệu theo tuần lọc (nếu không chọn tuần, mặc định tuần mới nhất)
  const filteredWeekly = weeklyReports.filter(row => {
    const date = row.to_date || "";
    return (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
  });

  const groupedWeekly = groupWeeklyByBigGroup(filteredWeekly);

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

      {/* HIỂN THỊ THEO NHÓM LỚN */}
      {Object.entries(groupedWeekly).map(([bigGroup, rows], idxGroup) => (
        <div key={bigGroup} style={{ marginBottom: 36 }}>
          <h2 style={{ fontWeight: 700, fontSize: 24, color: "#0a3e6d" }}>
            {idxGroup + 1}. {bigGroup}
          </h2>
          <table border={2} cellPadding={8} style={{ background: "#fff", minWidth: 1100 }}>
            <thead>
              <tr>
                <th>STT</th>
                <th>Tên công việc</th>
                <th>Lý trình</th>
                <th>Đơn vị</th>
                <th>Khối lượng tuần</th>
                <th>Khối lượng HĐ</th>
                <th>% hoàn thành</th>
                <th>Ghi chú</th>
                <th>AI chỉ đạo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const matched = projectTasks.find(
                  (pt) =>
                    normalizeString(pt.task_name) === normalizeString(row.sub_name) &&
                    (pt.unit || pt.dvt || pt.donvi || "").toLowerCase() === (row.unit || "").toLowerCase()
                );
                const weekQty = parseWeekValue(row.thiet_ke, row.unit || "");
                const contractQty = matched ? calcContractQuantity(matched.design_quantity, matched.unit || "") : 0;
                const percent = (contractQty > 0 && weekQty > 0) ? ((weekQty / contractQty) * 100).toFixed(2) : "";
                const aiKey = `${bigGroup}_${idx}`;
                return (
                  <React.Fragment key={idx}>
                    <tr>
                      <td>{idx + 1}</td>
                      <td>{row.sub_name || ""}</td>
                      <td>{row.ly_trinh || ""}</td>
                      <td>{row.unit || ""}</td>
                      <td>{formatVnNumber(weekQty)}</td>
                      <td>{formatVnNumber(contractQty)}</td>
                      <td>{percent ? `${percent}%` : ""}</td>
                      <td>{row.note || ""}</td>
                      <td>
                        {(row.note && row.note.trim()) && (
                          <>
                            <button
                              onClick={() => {
                                if (!aiResponses[aiKey] || aiResponses[aiKey] === "Đang lấy ý kiến AI...") {
                                  fetchAiSuggestion({
                                    taskName: row.sub_name,
                                    actualQty: formatVnNumber(weekQty),
                                    contractQty: formatVnNumber(contractQty),
                                    note: row.note,
                                  }, aiKey);
                                }
                              }}
                              style={{
                                background: "#0d47a1", color: "#fff", border: "none",
                                borderRadius: 4, padding: "3px 12px", cursor: "pointer"
                              }}>
                              {aiResponses[aiKey] && aiResponses[aiKey] !== "Đang lấy ý kiến AI..." ? "Lấy lại AI" : "Lấy ý kiến AI"}
                            </button>
                            <div>
                              {(aiResponses[aiKey]) && (
                                <div style={{ color: "#2d3d4b", marginTop: 3 }}>
                                  <b>AI:</b> {aiResponses[aiKey]}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
