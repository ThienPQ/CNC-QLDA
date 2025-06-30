import { useState, useEffect } from 'react';
import axios from 'axios';

export default function LanhDaoBan() {
  const [data, setData] = useState([]);
  const [fromDate, setFromDate] = useState('2025-06-09');
  const [toDate, setToDate] = useState('2025-06-22');
  const [error, setError] = useState(null);

  useEffect(() => {
    axios
      .get('/api/get-report-ai', { params: { fromDate, toDate } })
      .then((res) => setData(res.data.data))
      .catch(() => setError('Không thể tải dữ liệu báo cáo'));
  }, [fromDate, toDate]);

  // Gom lại theo hạng mục cha
  const grouped = {};
  data.forEach(item => {
    const groupKey = `${item.group_code} - ${item.group_name}`;
    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push(item);
  });

  return (
    <div style={{ padding: 20 }}>
      <h1>Báo cáo tuần và đánh giá</h1>
      <div style={{ marginBottom: 12 }}>
        <span>Từ ngày: </span>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        <span> Đến ngày: </span>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
      </div>
      {error && <div style={{ color: "red" }}>{error}</div>}

      {Object.keys(grouped).length === 0 ? (
        <p>Không có dữ liệu báo cáo.</p>
      ) : (
        Object.entries(grouped).map(([groupKey, rows]) => (
          <div key={groupKey}>
            <h2 style={{ marginTop: 20 }}>{groupKey}</h2>
            <table
              border={1}
              cellPadding={5}
              style={{ width: '100%', marginBottom: 12, background: "#fff" }}
            >
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
                {rows.map((item, idx) => (
                  <tr key={item.sub_code + idx}>
                    <td>{idx + 1}</td>
                    <td>{item.sub_name}</td>
                    <td>{item.ly_trinh}</td>
                    <td>{item.unit}</td>
                    <td>{item.thiet_ke}</td>
                    <td>{item.thiet_ke_hd}</td>
                    <td>{item.percent_contract ? item.percent_contract + "%" : ""}</td>
                    <td>{item.note}</td>
                    <td>{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {/* Đánh giá AI tổng hợp phía dưới */}
      <div style={{ background: '#eaffea', marginTop: 20, padding: 24 }}>
        <b>Đánh giá AI tổng hợp tự động:</b>
        <div>
          <ul>
            {data.map((item, idx) => (
              <li key={idx}>
                <b>{item.group_code} - {item.group_name} / {item.sub_code} {item.sub_name}:</b>
                &nbsp; Lũy kế thực hiện <b>{item.thiet_ke}</b>/{item.thiet_ke_hd} {item.unit}
                (<b>{item.percent_contract}%</b>) – <b>{item.status}</b>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
