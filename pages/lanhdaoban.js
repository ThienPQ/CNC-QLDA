// pages/lanhdaoban.js (Phiên bản tinh gọn)
import { useEffect, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import Head from 'next/head';

export default function LanhDaoBan() {
  const [headers, setHeaders] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    const fetchLatest = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await axios.get('/api/get-latest-report');
        setHeaders(res.data.headers || []);
        setReportData(res.data.rows || []);
      } catch (err) {
        console.error('Lỗi tải báo cáo:', err);
        setError(err.response?.data?.error || 'Không thể tải được báo cáo.');
      } finally {
        setLoading(false);
      }
    };
    fetchLatest();
  }, []);
  
  const handleAI = async () => { /* ... giữ nguyên như cũ, chỉ cần sửa phần body ... */ 
    try {
        const dataForAI = reportData.map(rowArray => {
            let obj = {};
            headers.forEach((header, index) => { obj[header] = rowArray[index]; });
            return obj;
        });
        const response = await fetch('/api/ai-evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportData: dataForAI }), // Chỉ gửi reportData
        });
        // ... phần còn lại của hàm handleAI giữ nguyên
    } catch (e) { /*...*/ }
  };

  const formatCellContent = (value, columnName) => { /* ... giữ nguyên như cũ ... */ };
  const getCellAlignment = (columnName) => { /* ... giữ nguyên như cũ ... */ };

  return (
    <>
      <Head><title>Báo Cáo Tiến Độ Tinh Gọn</title></Head>
      <div className="p-4 sm:p-6 lg:p-8 font-sans bg-gray-50 min-h-screen">
        <div className="max-w-screen-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Báo Cáo Tiến Độ Tinh Gọn</h1>
          
          {loading && <p>Đang tải...</p>}
          {error && <div role="alert">{error}</div>}
          
          {!loading && !error && reportData.length > 0 && (
            <div className="space-y-8">
              <div className="overflow-x-auto shadow-md rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-100">{/* ... */}</thead>
                  <tbody className="bg-white divide-y divide-gray-200">{/* ... */}</tbody>
                </table>
              </div>

              <div>
                <button onClick={handleAI} disabled={isAiLoading} className="bg-indigo-600 ...">
                  {isAiLoading ? 'AI đang phân tích...' : 'AI Đánh Giá'}
                </button>
              </div>

              <div className="mt-4">
                {isAiLoading && !aiResult && <p>Vui lòng chờ...</p>}
                {aiError && <div role="alert">Lỗi: {aiError}</div>}
                {aiResult && (
                  <div className="p-5 mt-2 border ...">
                    <h3 className="font-bold ...">Phân Tích từ AI:</h3>
                    <div className="text-gray-700">
                      <ReactMarkdown>{aiResult}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {!loading && !error && reportData.length === 0 && (<p>Không có dữ liệu.</p>)}
        </div>
      </div>
    </>
  );
}