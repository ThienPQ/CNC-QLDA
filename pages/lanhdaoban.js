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

  // ... (phần useEffect để fetchLatest giữ nguyên)
  useEffect(() => {
    const fetchLatest = async () => {
      // ... code này giữ nguyên như cũ
    };
    fetchLatest();
  }, []);

  // ==========================================================
  // HÀM handleAI ĐƯỢC VIẾT LẠI HOÀN TOÀN ĐỂ XỬ LÝ STREAMING
  // ==========================================================
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
        throw new Error(`Server responded with status ${response.status}`);
      }

      // Lấy về bộ đọc của luồng dữ liệu
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
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

  // ... (phần return JSX giữ nguyên như cũ)
  return (
      // ... toàn bộ code JSX của bạn ở đây
  );
}