// pages/lanhdaoban.js (Phiên bản cuối cùng, đã tinh chỉnh định dạng số)
import { useEffect, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import Head from 'next/head';

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
    // ... (Hàm handleAI giữ nguyên như cũ)
  };

  // --- HÀM ĐỊNH DẠNG SỐ ĐƯỢC CẬP NHẬT ---
  const formatCellContent = (value, columnName) => {
    // Nếu giá trị rỗng hoặc không phải số, trả về chính nó
    if (value === null || value === '' || isNaN(Number(value))) {
      return value;
    }

    const number = parseFloat(value);

    // Danh sách các cột cần định dạng là phần trăm
    const percentColumns = ['% Hoàn thành trong tuần', '% Hoàn thiện theo dự án'];
    if (percentColumns.includes(columnName)) {
      // Nhân 100 và làm tròn 2 chữ số thập phân
      return `${(number * 100).toFixed(2)}%`;
    }

    // Danh sách các cột cần định dạng là số với 2 chữ số thập phân
    const numericColumns = [
        'Thiết kế',
        'Lũy kế tuần trước',
        'Kế hoạch tuần trước',
        'Thực hiện',
        'Lũy kế đến nay',
        'Tổng KL' // Thêm cột Tổng KL nếu có
    ];
    if (numericColumns.includes(columnName)) {
      return number.toFixed(2);
    }
    
    // Các cột khác (như STT) giữ nguyên giá trị gốc
    return value;
  };

  // Hàm kiểm tra để căn lề phải cho các cột số
  const isNumericColumn = (columnName) => {
    const allNumericColumns = [
        'Thiết kế', 'Tổng KL', 'Lũy kế tuần trước', 'Kế hoạch tuần trước', 'Thực hiện', 'Lũy kế đến nay',
        '% Hoàn thành trong tuần', '% Hoàn thiện theo dự án'
    ];
    return allNumericColumns.includes(columnName);
  };

  return (
    <>
      <Head>
        <title>Báo Cáo Tiến Độ Dự Án</title>
      </Head>
      <div className="p-4 sm:p-6 lg:p-8 font-sans bg-gray-50 min-h-screen">
        <div className="max-w-screen-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Bảng Theo Dõi Tiến Độ Dự Án</h1>
          
          {loading && <p className="text-center text-gray-600">Đang tải dữ liệu báo cáo mới nhất...</p>}
          {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">{error}</div>}
          
          {!loading && !error && reportData.length > 0 && (
            <div className="space-y-8">
              <div className="overflow-x-auto shadow-md rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      {headers.map(header => (
                        <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.map((rowArray, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-gray-50 transition-colors duration-150">
                        {rowArray.map((cellValue, cellIndex) => {
                          const header = headers[cellIndex];
                          // Dùng hàm isNumericColumn để quyết định căn lề
                          const isNumeric = isNumericColumn(header);
                          return (
                            <td key={cellIndex} className={`px-4 py-3 text-sm text-gray-800 border-t border-gray-200 ${isNumeric ? 'text-right' : 'text-left'}`}>
                              {formatCellContent(cellValue, header)}
                            </td>
                          );
                         })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 border bg-white rounded-lg shadow-sm">
                  <h3 className="font-bold text-lg mb-2 text-gray-800">Kết luận</h3>
                  <p className="whitespace-pre-wrap text-gray-700">{conclusionText || 'Không có dữ liệu.'}</p>
                </div>
                <div className="p-5 border bg-white rounded-lg shadow-sm">
                  <h3 className="font-bold text-lg mb-2 text-gray-800">Kiến nghị</h3>
                  <p className="whitespace-pre-wrap text-gray-700">{recommendationText || 'Không có dữ liệu.'}</p>
                </div>
              </div>

              <div>
                <button onClick={handleAI} disabled={isAiLoading} className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  {isAiLoading ? 'AI đang phân tích...' : 'AI Đánh Giá Chuyên Sâu'}
                </button>
              </div>

              <div className="mt-4">
                {isAiLoading && !aiResult && <p className="text-gray-600">Vui lòng chờ, AI đang kết nối và phân tích dữ liệu...</p>}
                {aiError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg" role="alert">Lỗi: {aiError}</div>}
                {aiResult && (
                  <div className="p-5 mt-2 border bg-white rounded-lg prose max-w-none shadow-sm">
                    <h3 className="font-bold text-lg mb-2 text-gray-800">Phân Tích từ AI:</h3>
                    <div className="text-gray-700">
                      <ReactMarkdown>{aiResult}</ReactMarkdown>
                    </div>
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