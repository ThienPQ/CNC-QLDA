// pages/lanhdaoban.js

import { useState, useEffect } from "react";
import axios from "axios";

export default function LanhDaoBan() {
  const [fromDate, setFromDate] = useState("2025-06-09");
  const [toDate, setToDate] = useState("2025-06-15");
  const [reports, setReports] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");
  const [grouped, setGrouped] = useState({});

  // Lấy dữ liệu báo cáo tuần và hợp đồng
  useEffect(() => {
    async function fetchAll() {
      setError("");
      try {
        const res = await axios.get("/api/get-weekly-reports", {
          params: { from_date: fromDate, to_date: toDate },
        });
        setReports(Array.isArray(res.data.reports) ? res.data.reports : []);
        setTasks(Array.isArray(res.data.tasks) ? res.data.tasks : []);
      } catch (e) {
        setError("Không thể tải dữ liệu báo cáo");
        setReports([]);
        setTasks([]);
      }
    }
    fetchAll();
  }, [fromDate, toDate]);

  // Gom nhóm báo cáo tuần
  useEffect(() => {
    // group_code: { name, items: { sub_code: {...} } }
    let groupedData = {};
    if (!Array.isArray(reports)) return;
    reports.forEach((row) => {
      if (!row || !row.group_code) return;
      if (!groupedData[row.group_code]) {
        groupedData[row.group_code] = {
          name: row.group_name,
          items: {},
        };
      }
      groupedData[row.group_code].items[row.sub_code] = row;
    });
    setGrouped(groupedData);
  }, [reports]);

  // Lấy số lượng thiết kế theo hợp đồng (project tasks)
  function getContractDesign(sub_name, unit) {
    if (!Array.isArray(tasks)) return "";
    // Đối chiếu tên công việc và đơn vị
    let found = tasks.find(
      (t) =>
        t.task_name?.trim().toLowerCase() === sub_name?.trim().toLowerCase() &&
        (!unit || t.unit?.trim().toLowerCase() === unit?.trim().toLowerCase())
    );
    return found ? found.design_quantity : "";
  }

  // Đánh giá AI tự động: So sánh tiến độ từng hạng mục với hợp đồng
  function getAIEval() {
    let result = [];
    Object.entries(grouped).forEach(([group_code, group]) => {
      result.push(`- ${group_code} - ${group.name}:`);
      Object.values(group.items).forEach((item) => {
        // Tính % so với hợp đồng
        let contractVal = getContractDesign(item.sub_name, item.unit);
        let percentContract = contractVal && Number(contractVal) > 0
          ? Math.round((Number(item.thiet_ke || 0) / Number(contractVal)) * 100)
          : 0;
        result.push(
          `  + ${item.sub_code || ""} ${item.sub_name || ""}: Thực hiện ${item.thiet_ke || 0} (${item.unit}), hợp đồng ${contractVal || "?"}. Hoàn thành: ${percentContract}%`
        );
      });
    });
    if (result.length === 0) return "Không có dữ liệu.";
    return result.join("\n");
  }

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontWeight: 700, fontSize: 36, marginBottom: 16 }}>
        Báo cáo tuần và đánh giá
      </h1>
      <div style={{ marginBottom: 20 }}>
        Từ ngày:{" "}
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          style={{ marginRight: 10 }}
        />
        Đến ngày:{" "}
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
      </div>
      {error && (
        <div style={{ color: "red", marginBottom: 10 }}>{error}</div>
      )}
      {Object.keys(grouped).length === 0 ? (
        <div>Không có dữ liệu báo cáo.</div>
      ) : (
        Object.entries(grouped).map(([group_code, group], idx) => (
          <div key={group_code} style={{ marginBottom: 36 }}>
            <h2 style={{ fontWeight: 700, fontSize: 28 }}>
              {group_code} - {group.name}
            </h2>
            <table border={1} cellPadding={4} style={{ width: "100%", marginBottom: 20 }}>
              <thead style={{ background: "#eee" }}>
                <tr>
                  <th>STT</th>
                  <th>Tên công việc</th>
                  <th>Lý trình</th>
                  <th>Đơn vị</th>
                  <th>Thiết kế (báo cáo tuần)</th>
                  <th>Thiết kế (hợp đồng)</th>
                  <th>% Hoàn thành tuần</th>
                  <th>% Hoàn thành dự án</th>
                  <th>Ghi chú</th>
                  <th>Đánh giá</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(group.items).map((item, j) => {
                  let contractVal = getContractDesign(item.sub_name, item.unit);
                  let percentContract = contractVal && Number(contractVal) > 0
                    ? Math.round((Number(item.thiet_ke || 0) / Number(contractVal)) * 100)
                    : "";
                  return (
                    <tr key={j}>
                      <td>{j + 1}</td>
                      <td>{item.sub_name}</td>
                      <td>{item.ly_trinh}</td>
                      <td>{item.unit}</td>
                      <td>{item.thiet_ke}</td>
                      <td>{contractVal}</td>
                      <td>{item.percent_week}</td>
                      <td>{item.percent_duan}</td>
                      <td>{item.note}</td>
                      <td>
                        {contractVal
                          ? percentContract + "%"
                          : "Chưa có dữ liệu hợp đồng"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
      <div
        style={{
          background: "#ebfff0",
          padding: 16,
          marginTop: 16,
          borderRadius: 8,
          fontFamily: "monospace",
        }}
      >
        <b>Đánh giá AI tổng hợp tự động:</b>
        <pre>{getAIEval()}</pre>
      </div>
    </div>
  );
}
