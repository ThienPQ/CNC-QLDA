// pages/lanhdaoban.js (Phiên bản cuối cùng, đã tinh chỉnh giao diện)
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

  const handleAI = async () => { /* ... giữ nguyên như cũ ... */ };

  // SỬA HÀM NÀY: Định dạng số % ngắn gọn hơn (50% thay vì 50.00%)
  const formatCellContent = (value, columnName) => {
    const percentColumns = ['% Hoàn thành trong tuần', '% Hoàn thiện theo dự án'];
    if (percentColumns.includes(columnName)) {
      const number = parseFloat(value);
      if (!isNaN(number)) {
        // Làm tròn thành số nguyên
        return `${(number * 100).toFixed(0)}%`;
      }
    }
    return value;
  };

  return (
    // SỬA Ở ĐÂY: Bỏ max-w-.. để trang co giãn toàn màn hình
    <div className="p-4 sm:p-8 font-sans w-full"> 
      <h1 className="text-2xl font-bold mb-4">Bảng Theo Dõi Tiến Độ Dự Án</h1>
      {loading && <p>Đang tải dữ liệu báo cáo mới nhất...</p>}
      {error && <p className="text-red-500 bg-red-100 p-3 rounded">{error}</p>}
      
      {!loading && !error && reportData.length > 0 && (
        <>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            {/* SỬA Ở ĐÂY: Thêm các class của Tailwind CSS để bảng đẹp hơn */}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {headers.map(header => (
                    <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((rowArray, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-50">
                    {rowArray.map((cellValue, cellIndex) => (
                       <td key={cellIndex} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {formatCellContent(cellValue, headers[cellIndex])}
                       </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 border border-gray-200 bg-white rounded-lg">
              <h3 className="font-bold text-lg mb-2">Kết luận:</h3>
              <p className="whitespace-pre-line text-gray-700">{conclusionText || 'Không có'}</p>
            </div>
            <div className="p-4 border border-gray-200 bg-white rounded-lg">
              <h3 className="font-bold text-lg mb-2">Kiến nghị:</h3>
              <p className="whitespace-pre-line text-gray-700">{recommendationText || 'Không có'}</p>
            </div>
          </div>

          <div className="mt-6">
            <button onClick={handleAI} disabled={isAiLoading} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition-all shadow-sm">
              {isAiLoading ? 'AI đang phân tích...' : 'AI Đánh Giá Chuyên Sâu'}
            </button>
          </div>

          <div className="mt-4">
            {isAiLoading && !aiResult && <p className="text-gray-600">Vui lòng chờ, AI đang kết nối...</p>}
            {aiError && <p className="text-red-600 bg-red-100 p-3 rounded-lg">Lỗi: {aiError}</p>}
            {aiResult && (
              <div className="p-5 mt-4 border border-gray-200 bg-white rounded-lg prose max-w-none shadow-sm">
                <h3 className="font-bold text-lg mb-2">Phân Tích từ AI:</h3>
                <ReactMarkdown>{aiResult}</ReactMarkdown>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}