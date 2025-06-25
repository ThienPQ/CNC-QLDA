// pages/lanhdaoban.js (Phiên bản cuối cùng, sửa lỗi định dạng bằng "từ khóa" và trim())
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

  const handleAI = async () => { /* Giữ nguyên như cũ */ };

  const formatCellContent = (value, columnName) => {
    // Luôn chuyển columnName thành chuỗi và trim() ngay từ đầu
    const trimmedColumnName = String(columnName || '').trim();
    
    // Nếu giá trị rỗng hoặc không phải số, trả về chính nó
    if (value === null || String(value).trim() === '' || isNaN(Number(value))) {
      return value;
    }

    const number = parseFloat(value);
    
    // Danh sách các cột %
    const percentColumns = ['% Hoàn thành trong tuần', '% Hoàn thiện theo dự án'];
    if (percentColumns.includes(trimmedColumnName)) {
      return `${(number * 100).toFixed(2)}%`;
    }

    // Danh sách các cột số cần làm tròn 1 chữ số
    const numericColumns = ['Thiết kế', 'Tổng KL', 'Lũy kế tuần trước', 'Kế hoạch tuần trước', 'Thực hiện', 'Lũy kế đến nay'];
    if (numericColumns.includes(trimmedColumnName)) {
      return number.toFixed(1);
    }
    
    return value;
  };

  const isNumericColumn = (columnName) => {
    const trimmedColumnName = String(columnName || '').trim();
    const allNumericColumns = ['Thiết kế', 'Tổng KL', 'Lũy kế tuần trước', 'Kế hoạch tuần trước', 'Thực hiện', 'Lũy kế đến nay', '% Hoàn thành trong tuần', '% Hoàn thiện theo dự án'];
    return allNumericColumns.includes(trimmedColumnName);
  };

  return (
    <>
      <Head>
        <title>Báo Cáo Tiến Độ Dự Án</title>
      </Head>
      <div className="p-4 sm:p-6 lg:p-8 font-sans bg-gray-50 min-h-screen">
        <div className="max-w-screen-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Bảng Theo Dõi Tiến Độ Dự Án</h1>
          {/* ... (Phần JSX còn lại giữ nguyên y hệt như cũ) ... */}
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
              {/* ... */}
            </div>
          )}
        </div>
      </div>
    </>
  );
}