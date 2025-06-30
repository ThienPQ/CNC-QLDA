import { useEffect, useState } from "react";
import Head from "next/head";
import axios from "axios";

// Hàm cộng dồn các giá trị số, chuyển về số nếu là chuỗi có dấu phẩy
const addNumber = (a, b) => {
  const parse = (x) => Number(String(x || "0").replace(/[^0-9.\-]/g, "")) || 0;
  return parse(a) + parse(b);
};

export default function LanhDaoBan() {
  const [reports, setReports] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState(null);

  // Tải dữ liệu khi vào trang
  useEffect(() => {
    fetchReports();
  }, []);

  // Fetch API
  async function fetchReports() {
    try {
      const res = await axios.get("/api/get-weekly-reports");
      let data = res.data;
      // Nếu trả về object, lấy đúng key
      if (!Array.isArray(data)) {
        if (Array.isArray(data.reports)) data = data.reports;
        else if (Array.isArray(data.data)) data = data.data;
        else data = [];
      }
      setReports(data);
      setError(null);
    } catch (err) {
      setError("Không thể tải báo cáo tuần.");
      setReports([]);
    }
  }

  // Lọc báo cáo theo khoảng ngày
  const filteredReports = Array.isArray(reports)
    ? reports.filter((row) => {
        // from_date, to_date dạng yyyy-mm-dd
        if (fromDate && row.from_date < fromDate) return false;
        if (toDate && row.to_date > toDate) return false;
        return true;
      })
    : [];

  // Group theo hạng mục cha
  function groupReports(data) {
    const group = {};
    for (const row of data) {
      const key = `${row.group_code || ""} - ${row.group_name || ""}`.trim();
      if (!group[key]) group[key] = {};
      // Gom tiếp theo sub_code (I.1, I.2...)
      const subKey = `${row.sub_code || ""} - ${row.sub_name || ""}`.trim();
      if (!group[key][subKey]) group[key][subKey] = [];
      group[key][subKey].push(row);
    }
    return group;
  }

  // Cộng dồn số liệu theo từng sub_code/sub_name
  function sumSubTasks(list) {
    // Lấy số liệu lớn nhất (cuối cùng) cho mỗi trường, cộng các trường số nếu muốn
    let sum = {
      thiet_ke: 0,
      percent_week: 0,
      percent_duan: 0,
      note: [],
    };
    let last = list[list.length - 1] || {};
    // Nếu muốn cộng dồn (tổng) thì sửa lại dưới đây
    for (let item of list) {
      sum.thiet_ke = addNumber(sum.thiet_ke, item.thiet_ke);
      sum.percent_week = addNumber(sum.percent_week, item.percent_week);
      sum.percent_duan = addNumber(sum.percent_duan, item.percent_duan);
      if (item.note) sum.note.push(item.note);
    }
    // Gán lại dữ liệu khác lấy ở dòng cuối
    sum = {
      ...last,
      thiet_ke: sum.thiet_ke,
      percent_week: sum.percent_week,
      percent_duan: sum.percent_duan,
      note: sum.note.join(" | "),
    };
    return sum;
  }

  // Gom dữ liệu cho UI
  const grouped = groupReports(filteredReports);

  // Đánh giá AI demo (có thể thay bằng API thật)
  function aiSummary() {
    let text = "Đánh giá tổng hợp tự động:\n";
    Object.entries(grouped).forEach(([groupName, subs]) => {
      text += `\n- ${groupName}:\n`;
      Object.entries(subs).forEach(([subName, rows]) => {
        let task = sumSubTasks(rows);
        text += `   + ${subName}: Tiến độ tuần ${task.percent_week}%, lũy kế dự án ${task.percent_duan}%. ${task.note ? "Ghi chú: " + task.note : ""}\n`;
      });
    });
    return text;
  }

  return (
    <div style={{ padding: 16 }}>
      <Head>
        <title>Báo cáo tuần và đánh giá</title>
      </Head>
      <h1 style={{ fontSize: 28, fontWeight: "bold" }}>Báo cáo tuần và đánh giá</h1>
      <div style={{ margin: "12px 0" }}>
        <label>Từ ngày: <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></label>
        <span style={{ margin: "0 8px" }}></span>
        <label>Đến ngày: <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></label>
      </div>
      {error && <div style={{ color: "red" }}>{error}</div>}
      {Object.keys(grouped).length === 0 ? (
        <div>Không có dữ liệu báo cáo.</div>
      ) : (
        Object.entries(grouped).map(([groupName, subs], i) => (
          <div key={groupName} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 22, fontWeight: "bold", marginTop: 24, marginBottom: 8 }}>{groupName}</h2>
            <table border={1} cellPadding={5} cellSpacing={0} style={{ width: "100%", marginBottom: 12 }}>
              <thead>
                <tr style={{ background: "#f6f6f6" }}>
                  <th>STT</th>
                  <th>Tên công việc</th>
                  <th>Lý trình</th>
                  <th>Đơn vị</th>
                  <th>Thiết kế</th>
                  <th>% Hoàn thành tuần</th>
                  <th>% Hoàn thành dự án</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(subs).map(([subName, rows], idx) => {
                  const data = sumSubTasks(rows);
                  return (
                    <tr key={subName}>
                      <td>{idx + 1}</td>
                      <td>{data.sub_name}</td>
                      <td>{data.ly_trinh}</td>
                      <td>{data.unit}</td>
                      <td>{data.thiet_ke}</td>
                      <td>{data.percent_week}</td>
                      <td>{data.percent_duan}</td>
                      <td>{data.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
      <div style={{ marginTop: 32, background: "#e6ffe6", padding: 16, borderRadius: 8 }}>
        <h3>Đánh giá AI tự động</h3>
        <pre style={{ whiteSpace: "pre-line" }}>{aiSummary()}</pre>
      </div>
    </div>
  );
}
