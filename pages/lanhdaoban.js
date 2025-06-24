// pages/lanhdaoban.js
import { useEffect, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

export default function LanhDaoBan() {
  // State cho dữ liệu báo cáo
  const [reportData, setReportData] = useState([]);
  const [conclusionText, setConclusionText] = useState('');
  const [recommendationText, setRecommendationText] = useState('');
  
  // State cho việc tải trang ban đầu
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State cho chức năng AI
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiError, setAiError] = useState('');

  // Tải dữ liệu báo cáo khi trang được mở
  useEffect(() => {
    const fetchLatest = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await axios.get('/api/get-latest-report');
        setReportData(res.data.rows || []);
        setConclusionText(res.data.conclusion || '');
        setRecommendationText(res.data.recommendation || '');
      } catch (err) {
        console.error('Lỗi tải báo cáo:', err);
        setError(err.response?.data?.error || 'Không thể tải được báo cáo. Vui lòng kiểm tra lại file đã upload.');
        setReportData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLatest();
  }, []);

  // Hàm xử lý khi nhấn nút AI, có hỗ trợ streaming
  const handleAI = async () => {
    if (reportData.length === 0) {
      setAiError('Không có dữ liệu báo cáo để phân tích.');
      return;
    }
    setIsAiLoading(true);
    setAiResult('');
    setAiError('');
    try {
      const response = await fetch('/api/ai-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportData,
          conclusion: conclusionText,
          recommendation: recommendationText,
        }),
      });

      if (!response.ok) {
        // Cố gắng đọc lỗi từ server nếu có
        const errorText = await response.text();
        throw new Error(errorText || `Server responded with status ${response.status}`);
      }

      // Lấy về bộ đọc của luồng dữ liệu
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Vòng lặp để đọc từng mẩu dữ liệu từ luồng
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break; // Dừng lại khi luồng kết thúc
        }
        // Giải mã từng mẩu dữ liệu và nối vào kết quả hiện tại
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

  // Hàm định dạng các ô phần trăm
  const formatCellContent = (value, columnName) => {
    const percentColumns = ['% Hoàn thành trong tuần', '% Hoàn thiện theo dự án'];
    
    if (percentColumns.includes(columnName)) {
      const number = parseFloat(value);
      if (!isNaN(number)) {
        return `${(number * 100).toFixed(2)}%`;
      }
    }
    return value;
  };

  return (
    <div className="p-8 font-sans">
      <h1 className="text-2xl font-bold mb-4">Bảng Theo Dõi Tiến Độ Dự Án</h1>
      {loading && <p>Đang tải dữ liệu báo cáo mới nhất...</p>}
      {error && <p className="text-red-500 bg-red-100 p-3 rounded">{error}</p>}
      
      {!loading && !error && (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-400">
              <thead className="bg-gray-200">
                <tr>
                  {reportData.length > 0 && Object.keys(reportData[0]).map(header => (
                    <th key={header} className="border p-2 font-bold text-sm">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-100 text-sm">
                    {Object.keys(row).map((key, cellIndex) => (
                       <td key={cellIndex} className="border p-2">
                        {formatCellContent(row[key], key)}
                       </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-4 border border-gray-300 bg-gray-50 rounded">
            <strong className="font-bold">Kết luận:</strong>
            <p className="whitespace-pre-line mt-1">{conclusionText || 'Không có'}</p>
          </div>

          <div className="mt-2 p-4 border border-gray-300 bg-gray-50 rounded">
            <strong className="font-bold">Kiến nghị:</strong>
            <p className="whitespace-pre-line mt-1">{recommendationText || 'Không có'}</p>
          </div>

          <div className="mt-6">
            <button
              onClick={handleAI}
              className="bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-400 transition-all"
              disabled={isAiLoading}
            >
              {isAiLoading ? 'AI đang phân tích...' : 'AI Đánh Giá Chuyên Sâu'}
            </button>
          </div>

          <div className="mt-4">
            {isAiLoading && !aiResult && <p>Vui lòng chờ, AI đang kết nối và phân tích dữ liệu...</p>}
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