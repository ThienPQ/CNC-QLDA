// pages/lanhdaoban.js
import { useEffect, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

export default function LanhDaoBan() {
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
      const res = await fetch('/api/evaluate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportData,
          conclusion: conclusionText,
          recommendation: recommendationText,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Server responded with status ${res.status}`);
      }

      const data = await res.json();
      setAiResult(data.result);
    } catch (error) {
      console.error('Lỗi khi gọi API đánh giá AI:', error);
      setAiError(error.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  // =================================================================
  // BẮT ĐẦU HÀM MỚI: ĐỊNH DẠNG DỮ LIỆU PHẦN TRĂM
  // =================================================================
  const formatCellContent = (value, columnName) => {
    const percentColumns = ['% Hoàn thành trong tuần', '% Hoàn thiện theo dự án'];
    
    // Kiểm tra xem có phải là cột cần định dạng không
    if (percentColumns.includes(columnName)) {
      // Chuyển giá trị sang số, ví dụ '0.5' -> 0.5
      const number = parseFloat(value);
      
      // Nếu là số hợp lệ, tiến hành định dạng
      if (!isNaN(number)) {
        // Giả sử giá trị là số thập phân (ví dụ 0.5 cho 50%)
        // Nhân với 100, làm tròn đến 2 chữ số thập phân và thêm ký tự '%'
        return `${(number * 100).toFixed(2)}%`;
      }
    }
    
    // Nếu không phải cột phần trăm hoặc không phải số, trả về giá trị gốc
    return value;
  };
  // =================================================================
  // KẾT THÚC HÀM MỚI
  // =================================================================

  return (
    <div className="p-8 font-sans">
      <h1 className="text-2xl font-bold mb-4">Báo Cáo Tiến Độ Tuần</h1>
      {loading && <p>Đang tải dữ liệu báo cáo mới nhất...</p>}
      {error && <p className="text-red-500 bg-red-100 p-3 rounded">{error}</p>}
      
      {!loading && !error && (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-400">
              <thead className="bg-gray-200">
                <tr>
                  {reportData.length > 0 && Object.keys(reportData[0]).map(header => (
                    <th key={header} className="border p-2 font-bold">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-100">
                    {Object.keys(row).map((key, cellIndex) => (
                       <td key={cellIndex} className="border p-2">
                        {/* SỬ DỤNG HÀM ĐỊNH DẠNG Ở ĐÂY */}
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
            {isAiLoading && <p>Vui lòng chờ, AI đang tổng hợp và phân tích dữ liệu...</p>}
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