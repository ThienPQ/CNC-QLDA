// pages/lanhdaoban.js (Phiên bản cuối cùng, rõ ràng và đầy đủ nhất)
import { useEffect, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import Head from 'next/head';

export default function LanhDaoBan() {
  // State cho dữ liệu
  const [headers, setHeaders] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [conclusionText, setConclusionText] = useState('');
  const [recommendationText, setRecommendationText] = useState('');
  
  // State cho trạng thái tải
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State cho chức năng AI
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiError, setAiError] = useState('');

  // Hàm tải dữ liệu báo cáo
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

  // Hàm gọi AI
  const handleAI = async () => {
    if (reportData.length === 0) {
      setAiError('Không có dữ liệu báo cáo để phân tích.');
      return;
    }
    setIsAiLoading(true);
    setAiResult('');
    setAiError('');
    try {
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
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Lỗi không xác định từ server.');
      }

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

  // Hàm định dạng nội dung ô
  const formatCellContent = (cellValue, columnName) => {
    const trimmedColumnName = String(columnName || '').trim();

    // Các cột số cần định dạng (làm tròn 1 chữ số thập phân)
    const numericColumns = [
      'Thiết kế', 'Tổng KL', 'Lũy kế tuần trước', 
      'Kế hoạch tuần trước', 'Thực hiện', 'Lũy kế đến nay'
    ];

    // Các cột phần trăm (làm tròn 2 chữ số thập phân)
    const percentColumns = ['% Hoàn thành trong tuần', '% Hoàn thiện theo dự án'];

    // Kiểm tra xem có phải là cột cần định dạng không
    const isNumeric = numericColumns.includes(trimmedColumnName);
    const isPercent = percentColumns.includes(trimmedColumnName);

    if (isNumeric || isPercent) {
      // Nếu giá trị không phải là số hợp lệ, trả về rỗng
      if (cellValue === null || String(cellValue).trim() === '' || isNaN(Number(cellValue))) {
        return '';
      }
      const number = parseFloat(cellValue);
      if (isPercent) {
        return `${(number * 100).toFixed(2)}%`;
      }
      if (isNumeric) {
        return number.toFixed(1);
      }
    }
    
    // Nếu không phải cột cần định dạng, trả về giá trị gốc
    return cellValue;
  };

  // Hàm kiểm tra để căn lề phải
  const isNumericColumn = (columnName) => {
    const trimmedColumnName = String(columnName || '').trim();
    const allNumericColumns = [
      'Thiết kế', 'Tổng KL', 'Lũy kế tuần trước', 'Kế hoạch tuần trước', 
      'Thực hiện', 'Lũy kế đến nay', '% Hoàn thành trong tuần', '% Hoàn thiện theo dự án'
    ];
    return allNumericColumns.includes(trimmedColumnName);
  };

  // Phần hiển thị giao diện
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
                <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      {headers.map((header, index) => (
                        <th key={`${header}-${index}`} scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-300">
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
                          const alignmentClass = isNumericColumn(header) ? 'text-right' : 'text-left';
                          return (
                            <td key={cellIndex} className={`px-4 py-3 text-sm text-gray-700 border-t border-gray-200 ${alignmentClass}`}>
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
           {!loading && !error && reportData.length === 0 && (
             <p className="text-center text-gray-500 mt-10">Không có dữ liệu báo cáo để hiển thị. Vui lòng vào trang upload để tải lên.</p>
           )}
        </div>
      </div>
    </>
  );
}