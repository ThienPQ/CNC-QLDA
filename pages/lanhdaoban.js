// pages/lanhdaoban.js
import { useEffect, useState } from 'react';
import Head from 'next/head';
import axios from 'axios';

export default function LanhDaoBan() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchReports() {
      try {
        const response = await axios.get('/api/get-weekly-reports');
        if (Array.isArray(response.data)) {
          setReports(response.data);
        } else {
          setReports([]);
          setError('Dữ liệu phản hồi không hợp lệ');
        }
      } catch (err) {
        setError('Không thể tải báo cáo tuần');
      }
    }
    fetchReports();
  }, []);

  if (!Array.isArray(reports)) {
    return <div className="p-4 text-red-500">Dữ liệu phản hồi không hợp lệ.</div>;
  }

  return (
    <div className="p-4">
      <Head>
        <title>Báo cáo tuần và đánh giá</title>
      </Head>

      <h1 className="text-2xl font-bold mb-4">Báo cáo tuần và đánh giá</h1>

      {error && <p className="text-red-500">{error}</p>}

      {reports.length === 0 ? (
        <p>Không có dữ liệu báo cáo.</p>
      ) : (
        reports.map((group, idx) => (
          <div key={idx} className="mb-8">
            <h2 className="text-xl font-semibold text-blue-700 mb-2">
              {group?.category || 'Hạng mục chưa xác định'}
            </h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1">STT</th>
                  <th className="border border-gray-300 px-2 py-1">Tên công việc</th>
                  <th className="border border-gray-300 px-2 py-1">Nhóm công việc</th>
                  <th className="border border-gray-300 px-2 py-1">Đơn vị</th>
                  <th className="border border-gray-300 px-2 py-1">Khối lượng</th>
                  <th className="border border-gray-300 px-2 py-1">% Hoàn thành HĐ</th>
                  <th className="border border-gray-300 px-2 py-1">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(group?.tasks) && group.tasks.length > 0 ? (
                  group.tasks.map((task, i) => (
                    <tr key={i}>
                      <td className="border border-gray-300 px-2 py-1">{task?.stt}</td>
                      <td className="border border-gray-300 px-2 py-1">{task?.task_name}</td>
                      <td className="border border-gray-300 px-2 py-1">{task?.group_name || ''}</td>
                      <td className="border border-gray-300 px-2 py-1">{task?.unit}</td>
                      <td className="border border-gray-300 px-2 py-1">{task?.volume_total}</td>
                      <td className="border border-gray-300 px-2 py-1">{task?.percent}</td>
                      <td className="border border-gray-300 px-2 py-1">{task?.note}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center border border-gray-300 py-2 text-gray-500">Không có công việc nào.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
