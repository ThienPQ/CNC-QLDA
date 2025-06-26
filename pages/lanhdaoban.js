// pages/lanhdaoban.js (Phiên bản Dashboard 2.0)
import { useEffect, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import Head from 'next/head';

export default function LanhDaoBanDashboard() {
  const [dashboardData, setDashboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiError, setAiError] = useState('');

  // Hàm gọi AI, sẽ được kích hoạt tự động
  const triggerAIAnalysis = async (data) => {
    setIsAiLoading(true);
    setAiResult('');
    setAiError('');
    try {
      // API AI sẽ tự lấy dữ liệu từ DB, chúng ta chỉ cần gửi tín hiệu để chạy
      const response = await fetch('/api/ai-evaluate-v2', { method: 'POST' });
      
      if (!response.body) throw new Error("Response body is null");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Lỗi không xác định.');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAiResult((prev) => prev + decoder.decode(value));
      }
    } catch (error) {
      setAiError(error.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await axios.get('/api/get-dashboard-data');
        setDashboardData(res.data);
        // Sau khi có dữ liệu, tự động chạy AI
        if (res.data.length > 0) {
          triggerAIAnalysis(res.data);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Không thể tải dữ liệu dashboard.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <>
      <Head><title>Dashboard Quản Lý Tiến Độ</title></Head>
      <div className="p-4 sm:p-6 lg:p-8 font-sans bg-gray-50 min-h-screen">
        <div className="max-w-screen-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard Quản Lý Tiến Độ Dự Án</h1>
          
          {loading && <p className="text-center text-gray-600">Đang tổng hợp và tính toán dữ liệu...</p>}
          {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert"><p>{error}</p></div>}
          
          {!loading && !error && (
            <div className="space-y-8">
              <div className="overflow-x-auto shadow-md rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">STT</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tên công việc</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">KL hoàn thành tuần này</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Tổng KL hoàn thành</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Tỷ lệ HT so với HĐ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dashboardData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">{index + 1}</td>
                        <td className="px-4 py-3 text-sm text-gray-800 font-medium">{item.full_task_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{(item.work_done_this_week || 0).toFixed(1)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{(item.total_work_done || 0).toFixed(1)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right font-semibold">{`${(item.completion_percentage * 100).toFixed(1)}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4">
                {isAiLoading && !aiResult && <p className="text-gray-600">AI đang phân tích dữ liệu lịch sử...</p>}
                {aiError && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">Lỗi AI: {aiError}</div>}
                {aiResult && (
                  <div className="p-5 mt-2 border bg-white rounded-lg shadow-sm prose max-w-none">
                    <h3 className="font-bold text-lg text-gray-800">Phân Tích & Đánh Giá Tự Động:</h3>
                    <div className="text-gray-700"><ReactMarkdown>{aiResult}</ReactMarkdown></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}