// pages/lanhdaoban.js
import { useEffect, useState } from 'react';

export default function LanhDaoBan() {
  const [data, setData] = useState([]);
  const [grouped, setGrouped] = useState({});

  useEffect(() => {
    fetch('/api/get-latest-report')
      .then(res => res.json())
      .then(res => {
        setData(res.rows || []);
      });
  }, []);

  useEffect(() => {
    const group = {};
    for (const item of data) {
      const stt = item.stt;
      if (/^\d+$/.test(stt)) {
        const parent = Object.keys(group).slice(-1)[0] || 'Khác';
        group[parent] = group[parent] || [];
        group[parent].push(item);
      } else if (/^[IVXLCDM]+$/i.test(stt)) {
        group[stt] = [];
      } else {
        group['Khác'] = group['Khác'] || [];
        group['Khác'].push(item);
      }
    }
    setGrouped(group);
  }, [data]);

  return (
    <div className={styles.container}>
      <h1>Báo cáo tuần và đánh giá</h1>
      {Object.entries(grouped).map(([group, items], idx) => (
        <div key={idx} style={{ marginBottom: '2rem' }}>
          <h2>Hạng mục {group}</h2>
          <table border="1" cellPadding="6">
            <thead>
              <tr>
                <th>STT</th>
                <th>Tên công việc</th>
                <th>Đơn vị</th>
                <th>Khối lượng</th>
                <th>% hoàn thành</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => (
                <tr key={i}>
                  <td>{row.stt}</td>
                  <td>{row.task_name}</td>
                  <td>{row.unit}</td>
                  <td>{row.volume_total}</td>
                  <td>{row.percent}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
