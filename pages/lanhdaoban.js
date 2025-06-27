// pages/lanhdaoban.js
import { useEffect, useState } from 'react';

export default function LanhDaoBan() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await fetch('/api/get-weekly-reports');
        const data = await res.json();
        setReports(data);
      } catch (e) {
        console.error('Lỗi khi tải báo cáo:', e);
      } finally {
        setLoading(false);
      }
    }

    fetchReports();
  }, []);

  if (loading) return <p>Đang tải dữ liệu...</p>;

  // Gom nhóm theo hạng mục từ STT (1., 2., 3.)
  const groupedReports = {};
  for (const r of reports) {
    const sttParts = r.stt.toString().split('.');
    const hangMuc = sttParts[0];
    const nhomCongViec = sttParts.length > 1 ? sttParts[0] + '.' + sttParts[1] : null;

    if (!groupedReports[hangMuc]) groupedReports[hangMuc] = {};
    if (nhomCongViec) {
      if (!groupedReports[hangMuc][nhomCongViec]) groupedReports[hangMuc][nhomCongViec] = [];
      groupedReports[hangMuc][nhomCongViec].push(r);
    } else {
      if (!groupedReports[hangMuc]['__root']) groupedReports[hangMuc]['__root'] = [];
      groupedReports[hangMuc]['__root'].push(r);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Báo cáo tuần và đánh giá</h1>
      {Object.keys(groupedReports).map(hm => (
        <div key={hm} className="mb-8">
          <h2 className="text-xl font-semibold text-blue-700 mb-2">Hạng mục {hm}</h2>
          {Object.keys(groupedReports[hm]).map(ncv => (
            <div key={ncv} className="mb-4">
              {ncv !== '__root' && <h3 className="text-md font-medium text-gray-700 mb-1">Nhóm công việc {ncv}</h3>}
              <table className="table-auto w-full border">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border px-2 py-1">STT</th>
                    <th className="border px-2 py-1">Tên công việc</th>
                    <th className="border px-2 py-1">Đơn vị</th>
                    <th className="border px-2 py-1">Khối lượng</th>
                    <th className="border px-2 py-1">% hoàn thành</th>
                    <th className="border px-2 py-1">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedReports[hm][ncv].map((r, i) => (
                    <tr key={i}>
                      <td className="border px-2 py-1">{r.stt}</td>
                      <td className="border px-2 py-1">{r.task_name}</td>
                      <td className="border px-2 py-1">{r.unit}</td>
                      <td className="border px-2 py-1">{r.volume_total}</td>
                      <td className="border px-2 py-1">{r.percent}%</td>
                      <td className="border px-2 py-1">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}