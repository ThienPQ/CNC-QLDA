import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import Head from "next/head";

// Helper: Ghép khối lượng hợp đồng từ projectTasks theo task_name (hoặc sub_name)
function getContractQuantity(taskName, projectTasks) {
  if (!taskName) return "";
  const matched = projectTasks.find(t =>
    (t.task_name || "").trim().toLowerCase() === taskName.trim().toLowerCase()
  );
  if (!matched) return "";
  // Nếu design_quantity là số kiểu "1.000" => ép kiểu giữ số 1000
  let qty = matched.design_quantity || "";
  if (typeof qty === "string" && /^\d+\.\d{3}$/.test(qty)) {
    qty = qty.replace(/\./g, "");
  }
  return qty;
}

export default function LanhDaoBan() {
  const [weeklyReports, setWeeklyReports] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const reports = (await axios.get("/api/get-weekly-reports")).data || [];
        const tasks = (await axios.get("/api/get-project-tasks")).data || [];
        setWeeklyReports(reports);
        setProjectTasks(tasks);
        if (reports.length > 0) {
          let maxToDate = reports[0].to_date;
          reports.forEach(row => {
            if (row.to_date && row.to_date > maxToDate) maxToDate = row.to_date;
          });
          let minFromDate = reports.find(row => row.to_date === maxToDate)?.from_date || reports[0].from_date;
          setFromDate(minFromDate);
          setToDate(maxToDate);
        }
      } catch (err) {
        setError("Không thể tải dữ liệu.");
      }
    }
    fetchData();
  }, []);

  // --- Xử lý dữ liệu cộng dồn tổng thực hiện ---
  const dataTree = useMemo(() => {
    // Gom theo group_code -> route -> task_name
    const tree = {};
    // Để cộng dồn từng công việc/tuyến
    const allSum = {};

    weeklyReports.forEach(row => {
      const group_code = row.group_code || "";
      const group_name = row.group_name || "";
      const route = (row.group_sub_code || row.tuyen || row.route || "").toString().trim();
      const taskName = row.sub_name || row.task_name || "";

      if (!group_code || !route || !taskName) return;
      // Tạo key gom nhóm
      const key = [group_code, route, taskName].join("||");
      if (!allSum[key]) allSum[key] = { sum: 0, notes: [], lastNote: "", lastDate: "" };

      // Thiet_ke là số thực hiện tuần này
      let thk = Number(row.thiet_ke || 0);
      if (!isNaN(thk)) {
        allSum[key].sum += thk;
      }
      // Ghi chú tuần mới nhất theo ngày
      if (row.note && row.note !== "nan") {
        if (!allSum[key].lastDate || row.to_date > allSum[key].lastDate) {
          allSum[key].lastDate = row.to_date;
          allSum[key].lastNote = row.note;
        }
      }

      // Nhóm vào cây hiển thị
      if (!tree[group_code]) tree[group_code] = { group_name, routes: {} };
      if (!tree[group_code].routes[route]) tree[group_code].routes[route] = {};
      if (!tree[group_code].routes[route][taskName]) tree[group_code].routes[route][taskName] = [];
      tree[group_code].routes[route][taskName].push(row);
    });

    // Bổ sung trường sum thực hiện, hợp đồng, % hoàn thành, ghi chú tuần mới nhất vào từng task
    Object.keys(tree).forEach(group_code => {
      Object.keys(tree[group_code].routes).forEach(route => {
        Object.keys(tree[group_code].routes[route]).forEach(taskName => {
          const contractQty = getContractQuantity(taskName, projectTasks);
          const sumThk = allSum[[group_code, route, taskName].join("||")].sum;
          const note = allSum[[group_code, route, taskName].join("||")].lastNote;
          // Chỉ lấy 1 dòng duy nhất cho 1 task để hiển thị gọn bảng
          tree[group_code].routes[route][taskName] = [{
            taskName,
            contractQty,
            sumThk,
            percent: contractQty && Number(contractQty) > 0 ? ((sumThk/Number(contractQty))*100).toFixed(2)+"%" : "",
            note: note || ""
          }];
        });
      });
    });
    return tree;
  }, [weeklyReports, projectTasks]);

  return (
    <div className="p-4">
      <Head>
        <title>Báo cáo tuần và tổng hợp</title>
      </Head>
      <h1 style={{fontWeight:800, fontSize:40}}>BÁO CÁO TUẦN - SO SÁNH KHỐI LƯỢNG HỢP ĐỒNG</h1>
      <div style={{marginBottom:12}}>
        <span>Từ ngày: </span>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        <span style={{marginLeft:16}}>Đến ngày: </span>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
      </div>
      {error && <div style={{color:"red", fontWeight:600}}>{error}</div>}
      {!error && weeklyReports.length === 0 && (
        <div>Không có dữ liệu báo cáo.</div>
      )}

      <div style={{margin:"30px 0 40px 0"}}>
        {Object.keys(dataTree).map((group_code, idx) => {
          const group = dataTree[group_code];
          const routes = group.routes;
          return (
            <div key={group_code} style={{marginBottom:40}}>
              <h2 style={{fontSize:32, fontWeight:700, color:"#143565", margin:"36px 0 14px 0"}}>
                {String.fromCharCode(73+idx)}. {group.group_name}
              </h2>
              {Object.keys(routes).sort((a,b)=>Number(a)-Number(b)).map((route, ridx) => (
                <div key={route} style={{marginBottom:24}}>
                  <h3 style={{fontSize:24, color:"#2451a6", fontWeight:700}}>
                    {ridx+1}. Tuyến {route}
                  </h3>
                  <table border={2} cellPadding={8} style={{minWidth:900, background:"#fff"}}>
                    <thead>
                      <tr>
                        <th>STT</th>
                        <th>Công việc</th>
                        <th>Khối lượng HĐ</th>
                        <th>Tổng thực hiện (tất cả tuần)</th>
                        <th>% Hoàn thành</th>
                        <th>Ghi chú tuần mới nhất</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(routes[route]).map((taskName, tIdx) => {
                        const item = routes[route][taskName][0];
                        return (
                          <tr key={tIdx}>
                            <td>{tIdx+1}</td>
                            <td>{item.taskName}</td>
                            <td>{item.contractQty}</td>
                            <td>{item.sumThk}</td>
                            <td>{item.percent}</td>
                            <td>{item.note}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
