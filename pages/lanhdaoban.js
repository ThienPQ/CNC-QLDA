import { useState, useEffect } from 'react';
import axios from 'axios';

export default function LanhDaoBan() {
  const [fromDate, setFromDate] = useState('2025-06-09');
  const [toDate, setToDate] = useState('2025-06-15');
  const [data, setData] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const [grouped, setGrouped] = useState({});

  useEffect(() => {
    async function fetchData() {
      try {
        setError('');
        const res = await axios.get('/api/get-weekly-reports', {
          params: { from_date: fromDate, to_date: toDate }
        });
        setData(Array.isArray(res.data.reports) ? res.data.reports : []);
        setTasks(Array.isArray(res.data.tasks) ? res.data.tasks : []);
      } catch (err) {
        setError('Không thể tải dữ liệu báo cáo');
        setData([]);
        setTasks([]);
      }
    }
    fetchData();
  }, [fromDate, toDate]);

  useEffect(() => {
    let groupedData = {};
    if (!Array.isArray(data)) return;
    data.forEach(row => {
      if (!row || !row.group_code) return;
      if (!groupedData[row.group_code]) {
        groupedData[row.group_code] = {
          name: row.group_name,
          items: {}
        };
      }
      if (!groupedData[row.group_code].items[row.sub_code]) {
        groupedData[row.group_code].items[row.sub_code] = { ...row, thiet_ke: 0, percent_week: 0, percent_duan: 0 };
      }
      groupedData[row.group_code].items[row.sub_code].thiet_ke += Number(row.thiet_ke || 0);
      groupedData[row.group_code].items[row.sub_code].percent_week = Number(row.percent_week);
      groupedData[row.group_code].items[row.sub_code].percent_duan = Number(row.percent_duan);
      groupedData[row.group_code].items[row.sub_code].sub_name = row.sub_name;
      groupedData[row.group_code].items[row.sub_code].ly_trinh = row.ly_trinh;
      groupedData[row.group_code].items[row.sub_code].unit = row.unit;
      groupedData[row.group_code].items[row.sub_code].note = row.note;
    });
    setGrouped(groupedData);
  }, [data]);

  const getContractValue = (subName) => {
    if (!Array.isArray(tasks)) return '';
    const task = tasks.find(t =>
      t.task_name?.trim() === subName?.trim()
    );
    return task ? task.design_quantity : '';
  };

  const renderAIEval = () => {
    let evals = [];
    Object.entries(grouped).forEach(([group_code, group]) => {
      evals.push(`${group_code} - ${group.name}:`);
      Object.values(group.items).forEach((item, idx) => {
        evals.push(
          `  ${item.sub_code}: Đã hoàn thành ${item.percent_week}% tuần này, lũy kế dự án ${item.percent_duan}%.`
        );
      });
    });
    return (
      <div style={{ background: "#ebfff0", padding: 16, marginTop: 16, borderRadius: 8 }}>
        <b>Đánh giá AI tổng hợp tự động:</b>
        <pre>{evals.join('\n')}</pre>
      </div>
    );
  };

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-4">Báo cáo tuần và đánh giá</h1>
      <div className="mb-4 flex items-center">
        <label>Từ ngày: </label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="mx-2 border p-1" />
        <label>Đến ngày: </label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="mx-2 border p-1" />
      </div>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      {Object.keys(grouped).length === 0
        ? <div>Không có dữ liệu báo cáo.</div>
        : Object.entries(grouped).map(([group_code, group], idx) => (
          <div key={group_code} className="mb-8">
            <h2 className="text-xl font-bold my-2">{group_code} - {group.name}</h2>
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-100">
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
                {Object.values(group.items).map((item, j) => (
                  <tr key={j}>
                    <td>{j + 1}</td>
                    <td>{item.sub_name}</td>
                    <td>{item.ly_trinh}</td>
                    <td>{item.unit}</td>
                    <td>{item.thiet_ke}</td>
                    <td>{getContractValue(item.sub_name)}</td>
                    <td>{item.percent_week}</td>
                    <td>{item.percent_duan}</td>
                    <td>{item.note}</td>
                    <td>
                      {getContractValue(item.sub_name)
                        ? (item.thiet_ke && getContractValue(item.sub_name)
                          ? `${Math.round(100 * Number(item.thiet_ke) / Number(getContractValue(item.sub_name)))}%`
                          : '') : 'Chưa có dữ liệu hợp đồng'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      }
      {renderAIEval()}
    </div>
  );
}
