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

  const handleAI = async () => {
    setIsAiLoading(true);
    setAiResult('');
    setAiError('');
    try {
      const dataForAI = reportData.map(rowArray => {
        const obj = {};
        headers.forEach((header, index) => { obj[header] = rowArray[index]; });
        return obj;
      });
      const response = await fetch('/api/ai-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportData: dataForAI }),
      });
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

  const formatCellContent = (value, columnName) => {
    const sColumnName = String(columnName || '').trim();
    if (value === null || String(value).trim() === '' || isNaN(Number(value))) {
      return value;
    }
    const number = parseFloat(value);
    if (sColumnName.includes('%')) {
      return `${(number * 100).toFixed(1)}%`;
    }
    const numericKeywords = ['Thiết kế', 'Tổng KL', 'Lũy kế', 'Kế hoạch', 'Thực hiện'];
    if (numericKeywords.some(keyword => sColumnName.includes(keyword))) {
      return number.toFixed(1);
    }
    return value;
  };

  const getCellAlignment = (columnName) => {
    const sColumnName = String(columnName || '').trim();
    if (sColumnName.includes('%') || ['Thiết kế', 'Tổng KL', 'Lũy kế', 'Kế hoạch', 'Thực hiện'].some(k => sColumnName.includes(k))) {
      return 'text-right';
    }
    return 'text-left';
  };

  return (
    <>
      <Head><title>Báo Cáo Tiến Độ Tinh Gọn</title></Head>
      <div className="p-4 sm:p-6 lg:p-8 font-sans bg-gray-50 min-h-screen">
        <div className="max-w-screen-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Báo Cáo Tiến Độ Tinh Gọn</h1>
          
          {loading && <p className="text-center text-gray-500">Đang tải...</p>}
          {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert"><p>{error}</p></div>}
          
          {!loading && !error && reportData.length > 0 && (
            <div className="space-y-8">
              <div className="overflow-x-auto shadow-md rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      {headers.map(header => (
                        <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.map((rowArray, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-gray-50">
                        {rowArray.map((cellValue, cellIndex) => (
                          <td key={cellIndex} className={`px-4 py-3 text-sm border-t ${getCellAlignment(headers[cellIndex])}`}>
                            {formatCellContent(cellValue, headers[cellIndex])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-4">
                <button onClick={handleAI} disabled={isAiLoading} className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition-all shadow-md">
                  {isAiLoading ? 'AI đang phân tích...' : 'AI Đánh Giá'}
                </button>
              </div>

              <div className="mt-4">
                {isAiLoading && !aiResult && <p className="text-gray-600">Vui lòng chờ...</p>}
                {aiError && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">Lỗi: {aiError}</div>}
                {aiResult && (
                  <div className="p-5 mt-2 border bg-white rounded-lg shadow-sm prose max-w-none">
                    <h3 className="font-bold text-lg text-gray-800">Phân Tích từ AI:</h3>
                    <div className="text-gray-700"><ReactMarkdown>{aiResult}</ReactMarkdown></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && !error && reportData.length === 0 && (
            <p className="text-center text-gray-500 mt-10">Không có dữ liệu báo cáo. Vui lòng vào trang upload để tải lên.</p>
          )}
        </div>
      </div>
    </>
  );
}