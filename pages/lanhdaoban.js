// pages/lanhdaoban.js (Phiên bản Chẩn Đoán Lỗi)
import { useEffect, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import Head from 'next/head';

export default function LanhDaoBan() {
  const [headers, setHeaders] = useState([]);
  const [reportData, setReportData] = useState([]);
  // ... các state khác giữ nguyên
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

  // --- HÀM ĐỊNH DẠNG VỚI CHỨC NĂNG DEBUG ---
  const formatCellContent = (value, columnName) => {
    // Danh sách các cột cần định dạng số
    const numericColumnsToFormat = [
      'Thiết kế', 'Tổng KL', 'Lũy kế tuần trước', 
      'Kế hoạch tuần trước', 'Thực hiện', 'Lũy kế đến nay'
    ];
    
    const trimmedColumnName = columnName ? String(columnName).trim() : '';

    // LOGGING ĐỂ DEBUG: In ra tên cột và so sánh
    if (numericColumnsToFormat.includes(trimmedColumnName)) {
      // Nếu tìm thấy, log ra để xác nhận
      console.log(`[DEBUG] OK: Cột '${trimmedColumnName}' được tìm thấy và sẽ được định dạng.`);
    } else {
      // Nếu không tìm thấy, và giá trị có vẻ là số, đây là điểm đáng ngờ.
      if (value && !isNaN(Number(value)) && !trimmedColumnName.includes('%')) {
        console.warn(`[DEBUG] LỖI?: Cột '${trimmedColumnName}' không được định dạng. Giá trị: '${value}'`);
        // In ra mã của từng ký tự trong tên cột để tìm ký tự lạ
        const charCodes = [];
        for (let i = 0; i < columnName.length; i++) {
            charCodes.push(columnName.charCodeAt(i));
        }
        console.log(`[DEBUG] Mã ký tự của tên cột '${columnName}' là: [${charCodes.join(', ')}]`);
      }
    }
    
    // Logic định dạng giữ nguyên như cũ
    if (value === null || value === '' || isNaN(Number(value))) return value;
    const number = parseFloat(value);
    if (trimmedColumnName.includes('%')) return `${(number * 100).toFixed(2)}%`;
    if (numericColumnsToFormat.includes(trimmedColumnName)) return number.toFixed(2);
    return value;
  };

  const isNumericColumn = (columnName) => { /* ... giữ nguyên như cũ ... */ };

  return (
    // ... Phần JSX giữ nguyên y hệt như cũ ...
  );
}