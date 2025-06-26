// pages/lanhdaoban.js (Phiên bản cuối cùng, sửa lỗi định dạng số triệt để)
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
        setError(err.response?.data?.error || 'Không thể tải được báo cáo.');
      } finally {
        setLoading(false);
      }
    };
    fetchLatest();
  }, []);

  const handleAI = async () => {
    // Logic gọi AI không thay đổi, bạn có thể giữ lại phiên bản cũ của mình
  };

  // --- HÀM ĐỊNH DẠNG ĐƯỢC VIẾT LẠI HOÀN CHỈNH ---
  const formatCellContent = (value, columnName) => {
    // Nếu giá trị là rỗng hoặc không phải là một chuỗi/số, trả về chính nó
    if (value === null || value === undefined || String(value).trim() === '') {
      return '';
    }

    const trimmedColumnName = String(columnName || '').trim();

    // Các cột số cần làm tròn 1 chữ số thập phân
    const numericColumns = [
      'Tổng KL',
      'Thiết kế', // Thêm 'Thiết kế' nếu có
      'Lũy kế tuần trước',
      'Kế hoạch tuần trước',
      'Thực hiện',
      'Lũy kế đến nay'
    ];

    // Các cột phần trăm
    const percentColumns = ['% Hoàn thành trong tuần', '% Hoàn thiện theo dự án'];

    // Chuyển đổi giá trị thành số. Nếu không được, trả về giá trị gốc.
    const number = Number(value);
    if (isNaN(number)) {
      return value;
    }

    // Áp dụng định dạng
    if (percentColumns.includes(trimmedColumnName)) {
      return `${(number * 100).toFixed(1)}%`;
    }
    
    if (numericColumns.includes(trimmedColumnName)) {
      return number.toFixed(1);
    }
    
    // Trả về giá trị gốc cho các cột khác như STT
    return value;
  };
  
  // Hàm căn lề phải cho các cột số
  const getCellAlignment = (columnName) => {
    const trimmedColumnName = String(columnName || '').trim();
    const allNumericColumns = [
      'Tổng KL', 'Thiết kế', 'Lũy kế tuần trước', 'Kế hoạch tuần trước', 
      'Thực hiện', 'Lũy kế đến nay', '% Hoàn thành trong tuần', '% Hoàn thiện theo dự án'
    ];
    if (allNumericColumns.includes(trimmedColumnName)) {
      return 'text-right';
    }
    return 'text-left';
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
          {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert"><p>{error}</p></div>}
          
          {!loading && !error && reportData.length > 0 && (
            <div className="space-y-8">
              <div className="overflow-x-auto shadow-lg rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 border">
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
                      <tr key={rowIndex} className="hover:bg-gray-50">
                        {rowArray.map((cellValue, cellIndex) => {
                          const header = headers[cellIndex];
                          const alignmentClass = getCellAlignment(header);
                          return (
                            <td key={cellIndex} className={`px-4 py-4 text-sm text-gray-800 border-t border-gray-200 ${alignmentClass}`}>
                              {formatCellContent(cellValue, header)}
                            </td>
                          );
                         })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phần hiển thị AI đã được tinh gọn theo yêu cầu */}
              <div className="pt-4">
                <button onClick={handleAI} disabled={isAiLoading} className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-md">
                  {isAiLoading ? 'AI đang phân tích...' : 'AI Đánh Giá'}
                </button>
              </div>
              <div className="mt-4">
                {isAiLoading && !aiResult && <p>AI đang phân tích dữ liệu lịch sử...</p>}
                {aiError && <div role="alert">Lỗi AI: {aiError}</div>}
                {aiResult && (
                  <div className="p-5 mt-2 border bg-white rounded-lg shadow-sm">
                    <h3 className="font-bold">Phân Tích & Đánh Giá Tự Động:</h3>
                    <div><ReactMarkdown>{aiResult}</ReactMarkdown></div>
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