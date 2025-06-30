// pages/lanhdaoban.js
import { useEffect, useState } from "react";
import Head from "next/head";
import axios from "axios";

export default function LanhDaoBan() {
  const [reports, setReports] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState(null);
  const [aiSummary, setAiSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (reports.length > 0) evaluateAI();
    // eslint-disable-next-line
  }, [reports, fromDate, toDate]);

  async function fetchReports() {
    setIsLoading(true);
    try {
      const response = await axios.get("/api/get-weekly-reports");
      setReports(response.data || []);
      setError(null);
    } catch (err) {
      setError("Không thể tải báo cáo tuần");
      setReports([]);
    }
    setIsLoading(false);
  }

  // Lọc dữ liệu theo khoảng thời gian được chọn
  const filteredReports = reports.filter((item) => {
    const itemFrom = item.from_date;
    if (fromDate && itemFrom < fromDate) return false;
    if (toDate && itemFrom > toDate) return false;
    return true;
  });

  // Lũy kế số liệu các tuần: cộng dồn thiet_ke, giữ % mới nhất, note mới nhất...
  function getAggregatedData(data) {
    const result = {};
    for (const row of data) {
      const groupKey = row.group_code || "Khác";
      const subKey = row.sub_code || row.sub_name || "Khác";
      if (!result[groupKey]) result[groupKey] = { name: row.group_name, sub: {} };
      if (!result[groupKey].sub[subKey]) {
        result[groupKey].sub[subKey] = {
          sub_code: row.sub_code,
          sub_name: row.sub_name,
          ly_trinh: row.ly_trinh,
          unit: row.unit,
          thiet_ke: 0,
          percent_week: row.percent_week,
          percent_duan: row.percent_duan,
          note: row.note,
          latest_from: row.from_date,
          latest_to: row.to_date,
        };
      }
      // Cộng dồn khối lượng thiết kế
      const t = parseFloat(row.thiet_ke) || 0;
      result[groupKey].sub[subKey].thiet_ke += t;
      // Giữ số % và ghi chú của lần cập nhật mới nhất
      if (row.to_date >= result[groupKey].sub[subKey].latest_to) {
        result[groupKey].sub[subKey].percent_week = row.percent_week;
        result[groupKey].sub[subKey].percent_duan = row.percent_duan;
        result[groupKey].sub[subKey].note = row.note;
        result[groupKey].sub[subKey].latest_from = row.from_date;
        result[groupKey].sub[subKey].latest_to = row.to_date;
      }
    }
    return result;
  }

  const grouped = getAggregatedData(filteredReports);

  // Tự động đánh giá AI mỗi khi dữ liệu thay đổi
  async function evaluateAI() {
    setAiSummary("Đang đánh giá tiến độ tự động...");
    try {
      // Demo: Bạn cần thay bằng API thực của bạn!
      const response = await axios.post("/api/ai-evaluate", {
        data: grouped,
        fromDate,
        toDate,
      });
      setAiSummary(response.data.summary || "Không có đánh giá.");
    } catch (e) {
      setAiSummary("Không thể lấy đánh giá AI.");
    }
  }

  return (
    <div className="p-4">
      <Head>
        <title>Báo cáo tuần và đánh giá</title>
      </Head>
      <h1 className="text-2xl font-bold mb-4">Báo cáo tuần và đánh giá</h1>
      {error && <p className="text-red-500">{error}</p>}

      {/* Bộ lọc ngày */}
      <div className="mb-4 flex flex-wrap gap-2">
        <label>
          Từ ngày{" "}
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </label>
        <label>
          Đến ngày{" "}
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </label>
        <button
          className="bg-blue-600 text-white px-3 py-1 rounded"
          onClick={fetchReports}
        >
          Làm mới
        </button>
      </div>

      {/* Hiển thị dữ liệu lũy kế nhóm theo hạng mục */}
      {Object.keys(grouped).length === 0 ? (
        <p>Không có dữ liệu báo cáo.</p>
      ) : (
        Object.entries(grouped).map(([gcode, group]) => (
          <div key={gcode} className="mb-8">
            <h2 className="text-lg font-semibold mb-2">
              {gcode}. {group.name}
            </h2>
            <table className="w-full border-collapse border border-gray-300 mb-4">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1">Mã nhóm</th>
                  <th className="border px-2 py-1">Tên công việc</th>
                  <th className="border px-2 py-1">Lý trình</th>
                  <th className="border px-2 py-1">Đơn vị</th>
                  <th className="border px-2 py-1">Khối lượng lũy kế</th>
                  <th className="border px-2 py-1">% tuần mới nhất</th>
                  <th className="border px-2 py-1">% dự án mới nhất</th>
                  <th className="border px-2 py-1">Ghi chú</th>
                  <th className="border px-2 py-1">Kỳ báo cáo gần nhất</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(group.sub).map((item, idx) => (
                  <tr key={idx}>
                    <td className="border px-2 py-1">{item.sub_code}</td>
                    <td className="border px-2 py-1">{item.sub_name}</td>
                    <td className="border px-2 py-1">{item.ly_trinh}</td>
                    <td className="border px-2 py-1">{item.unit}</td>
                    <td className="border px-2 py-1">{item.thiet_ke}</td>
                    <td className="border px-2 py-1">{item.percent_week}</td>
                    <td className="border px-2 py-1">{item.percent_duan}</td>
                    <td className="border px-2 py-1">{item.note}</td>
                    <td className="border px-2 py-1">
                      {item.latest_from} ~ {item.latest_to}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {/* Đánh giá AI (tự động hiện, không cần nút) */}
      <div className="mt-8">
        <div className="bg-gray-100 rounded p-3 border text-base">
          <b>Kết quả đánh giá AI:</b>
          <div>{aiSummary || "Đang đánh giá..."}</div>
        </div>
      </div>
    </div>
  );
}
