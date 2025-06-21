// pages/lanhdaoban.js
import { useEffect, useState } from 'react';
import axios from 'axios';

export default function LanhDaoBan() {
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [aiResult, setAiResult] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    const res = await axios.get('/api/fetch-reports');
    const allReports = res.data;

    setReports(allReports);

    // Mặc định hiển thị báo cáo tuần gần nhất
    const latestToDate = [...allReports].sort((a, b) => b.toDate.localeCompare(a.toDate))[0]?.toDate;
    const latest = allReports.filter(r => r.toDate === latestToDate);
    setFilteredReports(latest);
  };

  const handleFilter = () => {
    const filtered = reports.filter(r => r.fromDate >= fromDate && r.toDate <= toDate);
    setFilteredReports(filtered);
  };

  const handleAIDanhGia = async () => {
    const res = await axios.post('/api/ai-evaluate', { reports: filteredReports });
    setAiResult(res.data.result);
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">BÁO CÁO TIẾN ĐỘ - LÃNH ĐẠO BAN</h1>

      <div className="flex space-x-4 mb-4">
        <div>
          <label>Từ ngày:</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border ml-2" />
        </div>
        <div>
          <label>Đến ngày:</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border ml-2" />
        </div>
        <button onClick={handleFilter} className="bg-blue-500 text-white px-4 py-2">Lọc báo cáo</button>
        <button onClick={handleAIDanhGia} className="bg-green-600 text-white px-4 py-2">AI đánh giá</button>
      </div>

      <table className="table-auto w-full border border-collapse mb-4">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2">Tuyến</th>
            <th className="border px-2">Khối lượng</th>
            <th className="border px-2">Tiến độ thực tế</th>
            <th className="border px-2">Tiến độ hợp đồng</th>
            <th className="border px-2">Đánh giá</th>
            <th className="border px-2">Giá trị thanh toán</th>
            <th className="border px-2">Ghi chú</th>
            <th className="border px-2">Từ ngày</th>
            <th className="border px-2">Đến ngày</th>
          </tr>
        </thead>
        <tbody>
          {filteredReports.map((r, idx) => (
            <tr key={idx} className="text-sm text-center">
              <td className="border">{r.tuyen}</td>
              <td className="border">{r.khoiLuong}</td>
              <td className="border">{r.tienDo}%</td>
              <td className="border">{r.tienDoHopDong}%</td>
              <td className="border">{r.danhGia}</td>
              <td className="border">{r.giaTriThanhToan}</td>
              <td className="border">{r.ghiChu}</td>
              <td className="border">{r.fromDate}</td>
              <td className="border">{r.toDate}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {aiResult && (
        <div className="p-4 bg-yellow-100 border border-yellow-400">
          <h2 className="font-bold mb-2">Đánh giá AI:</h2>
          <pre className="whitespace-pre-wrap">{aiResult}</pre>
        </div>
      )}
    </div>
  );
}
