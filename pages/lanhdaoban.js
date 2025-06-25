// pages/lanhdaoban.js
import { useEffect, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

export default function LanhDaoBan() {
  const [headers, setHeaders] = useState([]);
  const [reportData, setReportData] = useState([]); // Giờ đây sẽ là mảng của các mảng
  const [conclusionText, setConclusionText] = useState('');
  const [recommendationText, setRecommendationText] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // ... (phần state cho AI giữ nguyên)
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
  
  // ... (hàm handleAI giữ nguyên)
  const handleAI = async () => { /* ... */ };

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
      
      {!loading && !error && reportData.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-400">
              <thead className="bg-gray-200">
                <tr>
                  {headers.map(header => (
                    <th key={header} className="border p-2 font-bold text-sm">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* THAY ĐỔI CÁCH VẼ BẢNG */}
                {reportData.map((rowArray, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-100 text-sm">
                    {rowArray.map((cellValue, cellIndex) => (
                       <td key={cellIndex} className="border p-2">
                        {/* Lấy tên cột từ mảng headers để định dạng */}
                        {formatCellContent(cellValue, headers[cellIndex])}
                       </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ... (Phần Kết luận, Kiến nghị, nút AI giữ nguyên) ... */}
          
        </>
      )}
    </div>
  );
}