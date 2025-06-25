// pages/lanhdaoban.js (Phiên bản cuối cùng, sửa lỗi hiển thị)
import { useEffect, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

export default function LanhDaoBan() {
  const [headers, setHeaders] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [conclusionText, setConclusionText] = useState('');
  const [recommendationText, setRecommendationText] = useState('');
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
        setConclusionText(res.data.conclusion || '');
        setRecommendationText(res.data.recommendation || '');
      } catch (err) {
        console.error('Lỗi tải báo cáo:', err);
        setError(err.response?.data?.error || 'Không thể tải được báo cáo.');
      } finally {
        setLoading(false);
      }
    };
    fetchLatest();
  }, []);

  const handleAI = async () => {
    if (reportData.length === 0) {
      setAiError('Không có dữ liệu báo cáo để phân tích.');
      return;
    }
    setIsAiLoading(true);
    setAiResult('');
    setAiError('');
    try {
      // Để gọi AI, chúng ta cần chuyển đổi dữ liệu mảng về lại dạng object cho dễ xử lý
      const dataForAI = reportData.map(rowArray => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = rowArray[index];
        });
        return obj;
      });

      const response = await fetch('/api/ai-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportData: dataForAI,
          conclusion: conclusionText,
          recommendation: recommendationText,
        }),
      });
      if (!response.body) throw new Error("Response body is null");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setAiResult((prev) => prev + chunk);
      }
    } catch (error) {
      console.error('Lỗi khi gọi API đánh giá AI:', error);
      setAiError(error.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const formatCellContent = (value, columnName) => {
    const percentColumns = ['% Hoàn thành trong tuần', '% Hoàn thiện theo dự án'];
    if (percentColumns.includes(columnName)) {
      const number = parseFloat(value);
      if (!isNaN(number)) return `${(number * 100).toFixed(2)}%`;
    }
    return value;
  };

  return (
    <div className="p-8 font-sans">
      <h1 className="text-2xl font-bold mb-4">Bảng Theo Dõi Tiến Độ Dự Án</h1>
      {loading && <p>Đang tải dữ liệu báo cáo mới nhất...</p>}
      {error && <p className="text-red-500 bg-red-100 p-3 rounded">{error}</p>}
      
      {!loading && !error && reportData.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-400">
              <thead className="bg-gray-200">
                <tr>
                  {/* SỬA Ở ĐÂY: Dùng mảng 'headers' để vẽ tiêu đề, không dùng Object.keys nữa */}
                  {headers.map(header => (
                    <th key={header} className="border p-2 font-bold text-sm">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* SỬA Ở ĐÂY: Dùng mảng 'headers' để lặp qua và lấy dữ liệu đúng thứ tự */}
                {reportData.map((rowArray, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-100 text-sm">
                    {headers.map((header, cellIndex) => (
                       <td key={cellIndex} className="border p-2">
                        {/* Lấy giá trị của ô bằng chỉ số, và tên cột từ mảng headers */}
                        {formatCellContent(rowArray[cellIndex], header)}
                       </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-4 border border-gray-300 bg-gray-50 rounded">
            <strong className="font-bold">Kết luận:</strong> <p className="whitespace-pre-line mt-1">{conclusionText || 'Không có'}</p>
          </div>
          <div className="mt-2 p-4 border border-gray-300 bg-gray-50 rounded">
            <strong className="font-bold">Kiến nghị:</strong> <p className="whitespace-pre-line mt-1">{recommendationText || 'Không có'}</p>
          </div>
          <div className="mt-6">
            <button onClick={handleAI} disabled={isAiLoading} className="bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-400 transition-all">
              {isAiLoading ? 'AI đang phân tích...' : 'AI Đánh Giá Chuyên Sâu'}
            </button>
          </div>
          <div className="mt-4">
            {isAiLoading && !aiResult && <p>Vui lòng chờ, AI đang kết nối...</p>}
            {aiError && <p className="text-red-500 bg-red-100 p-3 rounded">Lỗi: {aiError}</p>}
            {aiResult && (
              <div className="p-4 border border-gray-300 bg-gray-50 rounded-lg prose max-w-none">
                <ReactMarkdown>{aiResult}</ReactMarkdown>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}