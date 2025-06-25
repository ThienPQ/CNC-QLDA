// pages/lanhdaoban.js (Phiên bản cuối cùng, sửa lỗi định dạng do ký tự trắng)
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

  const handleAI = async () => { /* ... giữ nguyên như cũ ... */ };

  // --- HÀM ĐỊNH DẠNG SỐ ĐƯỢC NÂNG CẤP ---
  const formatCellContent = (value, columnName) => {
    // Luôn kiểm tra xem columnName có tồn tại không trước khi dùng
    const trimmedColumnName = columnName ? String(columnName).trim() : '';
    
    // Nếu giá trị rỗng hoặc không phải số, trả về chính nó
    if (value === null || value === '' || isNaN(Number(value))) {
      return value;
    }

    const number = parseFloat(value);

    // Danh sách các cột cần định dạng là phần trăm
    // Giờ sẽ kiểm tra linh hoạt hơn, chỉ cần chứa ký tự '%'
    if (trimmedColumnName.includes('%')) {
      return `${(number * 100).toFixed(2)}%`;
    }

    // Danh sách các cột cần định dạng là số với 2 chữ số thập phân
    const numericColumns = [
        'Thiết kế',
        'Tổng KL',
        'Lũy kế tuần trước',
        'Kế hoạch tuần trước',
        'Thực hiện',
        'Lũy kế đến nay'
    ];
    // So sánh với tên cột đã được cắt bỏ khoảng trắng thừa
    if (numericColumns.includes(trimmedColumnName)) {
      return number.toFixed(2);
    }
    
    // Các cột khác (như STT) giữ nguyên giá trị gốc
    return value;
  };

  // --- HÀM KIỂM TRA SỐ ĐƯỢC NÂNG CẤP ---
  const isNumericColumn = (columnName) => {
    const trimmedColumnName = columnName ? String(columnName).trim() : '';
    
    const allNumericColumns = [
        'Thiết kế', 'Tổng KL', 'Lũy kế tuần trước', 'Kế hoạch tuần trước', 'Thực hiện', 'Lũy kế đến nay'
    ];

    // Căn lề phải nếu tên cột nằm trong danh sách hoặc tên cột chứa ký tự '%'
    return allNumericColumns.includes(trimmedColumnName) || trimmedColumnName.includes('%');
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