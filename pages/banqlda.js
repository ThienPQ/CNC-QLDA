// pages/banqlda.js
import { useState } from 'react';
import axios from 'axios';

export default function BanQLDA() {
  const [file, setFile] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  // Thêm state để lưu loại file được chọn, mặc định là báo cáo tuần
  const [fileType, setFileType] = useState('bao-cao-tuan.xlsx'); 
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      alert('Vui lòng chọn file để tải lên.');
      return;
    }

    setIsUploading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);
    // Gửi đi loại file đã chọn (filename)
    formData.append('filename', fileType); 
    // Vẫn gửi cả ngày tháng (dù có thể không dùng cho PLHD)
    formData.append('fromDate', fromDate);
    formData.append('toDate', toDate);

    try {
      const res = await axios.post('/api/upload-report', formData);
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
      <h1 className="text-2xl font-bold">Gửi Báo Cáo & Kế Hoạch</h1>
      
      {/* ========================================================== */}
      {/* THÊM Ô CHỌN LOẠI FILE MỚI */}
      {/* ========================================================== */}
      <div>
        <label htmlFor="fileType" className="block text-sm font-medium text-gray-700 mb-1">
          Chọn loại tài liệu để tải lên:
        </label>
        <select
          id="fileType"
          value={fileType}
          onChange={(e) => setFileType(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
        >
          <option value="bao-cao-tuan.xlsx">Báo Cáo Tuần</option>
          <option value="PLHD.xlsx">Phụ Lục Hợp Đồng (PLHD)</option>
        </select>
      </div>

      {/* Chỉ hiển thị ô chọn ngày tháng khi là báo cáo tuần */}
      {fileType === 'bao-cao-tuan.xlsx' && (
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
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Chọn File Excel (.xlsx):</label>
        <input type="file" required accept=".xlsx" onChange={(e) => setFile(e.target.files[0])} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
      </div>

      <button
        type="submit"
        disabled={isUploading}
        className="w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
      >
        {isUploading ? 'Đang gửi...' : 'Gửi Tài Liệu'}
      </button>

      {message && <p className="mt-4 text-center text-sm font-medium">{message}</p>}
    </form>
  );
}