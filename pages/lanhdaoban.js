import { useEffect, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

export default function LanhDaoBan() {
  const [headers, setHeaders] = useState([]);
  const [reportData, setReportData] = useState([]);
  // ... (các state khác giữ nguyên)

  useEffect(() => {
    const fetchLatest = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await axios.get('/api/get-latest-report');
        
        // --- LOG ĐỂ DEBUG ---
        console.log("Frontend received headers:", res.data.headers);
        console.log("Frontend received first data row:", res.data.rows[0]);
        // --- KẾT THÚC LOG ---

        setHeaders(res.data.headers || []);
        setReportData(res.data.rows || []);
        setConclusionText(res.data.conclusion || '');
        setRecommendationText(res.data.recommendation || '');
      } catch (err) { /* ... */ } 
      finally { /* ... */ }
    };
    fetchLatest();
  }, []);
  
  // ... (toàn bộ code còn lại của file giữ nguyên)
}