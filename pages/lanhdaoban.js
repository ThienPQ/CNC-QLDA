// pages/lanhdaoban.js
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function LanhDaoBan() {
  const [data, setData] = useState([]);
  const [fromDate, setFromDate] = useState('2025-06-09');
  const [toDate, setToDate] = useState('2025-06-22');
  const [error, setError] = useState(null);

  useEffect(() => {
    axios
      .get('/api/get-weekly-reports', { params: { fromDate, toDate } })
      .then((res) => setData(res.data))
      .catch(() => setError('Không thể tải dữ liệu báo cáo'));
  }, [fromDate, toDate]);

  // Nhóm dữ liệu theo group_code (hạng mục cha)
  const groupData = {};
  data.forEach(item => {
    if (!groupData[item.group_code]) groupData[item.group_code] = { name: item.group_name, subs: {} };
    if (!groupData[item.group_code].subs[item.sub_code])
      groupData[item.group_code].subs[item.sub_code] = { name: item.sub_name, rows: [] };
    groupData[item.group_code].subs[item.sub_code].rows.push(item);
  });

  // Cộng dồn các trường số
  const sumField = (arr, field) => arr.reduce((acc, curr) => acc + (parseFloat(curr[field]) || 0), 0);

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

      {Object.keys(groupData).length === 0 ? (
        <p>Không có dữ liệu báo cáo.</p>
      ) : (
        Object.entries(groupData).map(([group_code, group]) => (
          <div key={group_code}>
            <h2 style={{ marginTop: 20 }}>{group_code} - {group.name}</h2>
            {Object.entries(group.subs).map(([sub_code, sub], idx) => (
              <table
                border={1}
                cellPadding={5}
                style={{ width: '100%', marginBottom: 12, background: idx % 2 === 0 ? "#fff" : "#f8f8f8" }}
                key={sub_code}
              >
                <thead>
                  <tr>
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
                  <tr>
                    <td>1</td>
                    <td>{sub.name}</td>
                    <td>{sub.rows.map(x => x.ly_trinh).filter(Boolean).join('; ')}</td>
                    <td>{sub.rows.map(x => x.unit).filter(Boolean).join('; ')}</td>
                    <td>{sumField(sub.rows, 'thiet_ke')}</td>
                    <td>{sumField(sub.rows, 'percent_week')}</td>
                    <td>{sumField(sub.rows, 'percent_duan')}</td>
                    <td>{sub.rows.map(x => x.note).filter(Boolean).join('; ')}</td>
                  </tr>
                </tbody>
              </table>
            ))}
          </div>
        ))
      )}

      {/* Đánh giá AI tổng hợp phía dưới */}
      <div style={{ background: '#eaffea', marginTop: 20, padding: 24 }}>
        <b>Đánh giá AI tự động</b>
        <div>
          <div>Đánh giá tổng hợp tự động:</div>
          {Object.entries(groupData).map(([group_code, group]) => (
            <div key={group_code} style={{ marginBottom: 10 }}>
              <b>- {group_code} - {group.name}:</b>
              <ul>
                {Object.entries(group.subs).map(([sub_code, sub]) => (
                  <li key={sub_code}>
                    {sub.name}: tuần {sumField(sub.rows, 'percent_week')}%, lũy kế dự án {sumField(sub.rows, 'percent_duan')}%
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
