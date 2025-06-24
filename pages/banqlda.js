// pages/banqlda.js
import { useState } from 'react';
import axios from 'axios';

export default function BanQLDA() {
  const [file, setFile] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !fromDate || !toDate) {
      alert('Vui lòng chọn file và đầy đủ ngày tháng');
      return;
    }

    setIsUploading(true);
    setMessage('');

    const formData = new FormData();
    // Gửi file với tên trường là "file"
    formData.append('file', file);
    // !! THÊM fromDate và toDate vào formData để gửi đi
    formData.append('fromDate', fromDate);
    formData.append('toDate', toDate);

    try {
      // API endpoint vẫn là '/api/upload-report'
      const res = await axios.post('/api/upload-report', formData, {
        headers: {
          // Axios tự động set Content-Type đúng khi dùng FormData
          // nên không cần khai báo ở đây
        },
      });
      setMessage(res.data.message);
    } catch (error) {
      console.error(error);
      const errorMessage = error.response?.data?.error || 'Tải lên thất bại.';
      setMessage(`Lỗi: ${errorMessage}`);
    } finally {
        setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleUpload} className="p-8 font-sans max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Gửi Báo Cáo Tuần</h1>
      <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Từ ngày:</label>
          <input type="date" required value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Đến ngày:</label>
          <input type="date" required value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">File báo cáo (.xlsx):</label>
        <input type="file" required accept=".xlsx" onChange={(e) => setFile(e.target.files[0])} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
      </div>
      <button
        type="submit"
        disabled={isUploading}
        className="w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
      >
        {isUploading ? 'Đang gửi...' : 'Gửi Báo Cáo'}
      </button>
      {message && <p className="mt-4 text-center text-sm font-medium">{message}</p>}
    </form>
  );
}