import { useEffect, useState } from 'react';
import Head from 'next/head';
import axios from 'axios';

// Hàm khớp tên công việc (chữ thường, loại bỏ khoảng trắng dư)
function normalize(str) {
  return (str || '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function findTask(subName, projectTasks) {
  const normName = normalize(subName);
  return projectTasks.find(t => normalize(t.sub_name) === normName);
}

export default function LanhDaoBan() {
  const [reports, setReports] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [fromDate, setFromDate] = useState('2025-06-16');
  const [toDate, setToDate] = useState('2025-06-22');
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        // Lấy báo cáo tuần
        const res1 = await axios.get(`/api/get-weekly-reports`, {
          params: { from_date: fromDate, to_date: toDate },
        });
        setReports(Array.isArray(res1.data) ? res1.data : []);

        // Lấy hợp đồng
        const res2 = await axios.get(`/api/get-project-tasks`);
        setProjectTasks(Array.isArray(res2.data) ? res2.data : []);
        setError('');
      } catch (err) {
        setError('Không thể tải dữ liệu báo cáo');
      }
    }
    fetchData();
  }, [fromDate, toDate]);

  // Gom nhóm theo hạng mục cha (group_code, group_name)
  const grouped = {};
  reports.forEach(row => {
    if (!grouped[row.group_code]) {
      grouped[row.group_code] = {
        group_name: row.group_name,
        items: [],
      };
    }
    grouped[row.group_code].items.push(row);
  });

  // Tổng hợp đánh giá AI (giả lập logic đơn giản)
  const aiEval = [];
  Object.entries(grouped).forEach(([code, group]) => {
    let groupStr = `- ${code} - ${group.group_name}:\n`;
    group.items.forEach(item => {
      const matched = findTask(item.sub_name, projectTasks);
      if (!item.thiet_ke || isNaN(Number(item.thiet_ke))) return; // bỏ trống
      if (!matched) {
        groupStr += `  + ${item.sub_name}: Đã thực hiện ${item.thiet_ke} ${item.unit}, chưa có hợp đồng để so sánh.\n`;
      } else if (!matched.thiet_ke || isNaN(Number(matched.thiet_ke)) || Number(matched.thiet_ke) === 0) {
        groupStr += `  + ${item.sub_name}: Có báo cáo nhưng hợp đồng chưa ghi khối lượng (hoặc = 0).\n`;
      } else {
        const percent = ((Number(item.thiet_ke) / Number(matched.thiet_ke)) * 100).toFixed(1);
        groupStr += `  + ${item.sub_name}: Đạt ${(percent > 100 ? 100 : percent)}% so với hợp đồng (${item.thiet_ke}/${matched.thiet_ke} ${item.unit}).\n`;
      }
    });
    aiEval.push(groupStr);
  });

  return (
    <div className="p-4">
      <Head>
        <title>Báo cáo tuần và đánh giá</title>
      </Head>
      <h1 style={{fontSize: "2.2rem", fontWeight: 700, marginBottom: 24}}>Báo cáo tuần và đánh giá</h1>
      <div style={{marginBottom: 16}}>
        <span>Từ ngày: </span>
        <input
          type="date"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          style={{marginRight: 12}}
        />
        <span>Đến ngày: </span>
        <input
          type="date"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
        />
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {!reports.length && <div>Không có dữ liệu báo cáo.</div>}

      {Object.entries(grouped).map(([code, group], idx) => (
        <div key={code}>
          <h2 style={{fontSize: "2rem", fontWeight: 700, marginTop: 24}}>{code} - {group.group_name}</h2>
          <table border={1} cellPadding={8} cellSpacing={0} style={{width: "100%", marginBottom: 16}}>
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
                <th>Đánh giá</th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((item, i) => {
                const matched = findTask(item.sub_name, projectTasks);
                let designContract = '';
                let percentContract = '';
                let evalText = '';
                if (matched && matched.thiet_ke && !isNaN(Number(matched.thiet_ke)) && Number(matched.thiet_ke) > 0) {
                  designContract = matched.thiet_ke;
                  percentContract = ((Number(item.thiet_ke) / Number(matched.thiet_ke)) * 100).toFixed(1);
                  evalText = `${percentContract > 100 ? 100 : percentContract}% hợp đồng`;
                } else if (matched) {
                  designContract = '0';
                  percentContract = '';
                  evalText = 'Có báo cáo nhưng HĐ không ghi KL';
                } else {
                  designContract = 'Chưa có dữ liệu hợp đồng';
                  percentContract = '';
                  evalText = 'Chưa có dữ liệu hợp đồng';
                }
                return (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{item.sub_name}</td>
                    <td>{item.ly_trinh}</td>
                    <td>{item.unit}</td>
                    <td>{item.thiet_ke}</td>
                    <td>{designContract}</td>
                    <td>{percentContract}</td>
                    <td>{item.note}</td>
                    <td>{evalText}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{background: "#ecfff1", padding: 20, borderRadius: 12, marginTop: 30}}>
        <h2 style={{fontWeight: 700, fontSize: 22}}>Đánh giá AI tổng hợp tự động:</h2>
        <pre style={{margin: 0, fontSize: 17}}>
          {aiEval.length > 0 ? aiEval.join('\n\n') : "Không có dữ liệu."}
        </pre>
      </div>
    </div>
  );
}
