// pages/banqlda.js
import { useState } from 'react';
import axios from 'axios';

export default function BanQLDA() {
  const [fileHD, setFileHD] = useState(null);
  const [fileBC, setFileBC] = useState(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [message, setMessage] = useState('');

  const handleUploadHD = async () => {
    if (!fileHD) return;
    const formData = new FormData();
    formData.append('file', fileHD);

    try {
      const res = await axios.post('/api/upload-contract', formData);
      setMessage(res.data.message);
    } catch (err) {
      setMessage('Lỗi khi upload hợp đồng');
    }
  };

  const handleUploadBC = async () => {
    if (!fileBC || !dateRange.from || !dateRange.to) return;
    const formData = new FormData();
    formData.append('file', fileBC);
    formData.append('from', dateRange.from);
    formData.append('to', dateRange.to);

    try {
      const res = await axios.post('/api/upload-report', formData);
      setMessage(res.data.message);
    } catch (err) {
      setMessage('Lỗi khi upload báo cáo tuần');
    }
  };

  return (
    <div className="p-6 space-y-10">
      <h1 className="text-2xl font-bold mb-4">Gửi Báo Cáo và Hợp Đồng</h1>

      <div className="border p-4 rounded shadow">
        <h2 className="font-semibold mb-2">1. Tải lên Hợp đồng PLHD (không cần ngày)</h2>
        <input type="file" onChange={e => setFileHD(e.target.files[0])} />
        <button
          className="mt-2 px-4 py-1 bg-blue-600 text-white rounded"
          onClick={handleUploadHD}
        >
          Gửi Hợp đồng
        </button>
      </div>

      <div className="border p-4 rounded shadow">
        <h2 className="font-semibold mb-2">2. Tải lên Báo cáo tuần (có chọn ngày)</h2>
        <div className="flex gap-2 mb-2">
          <input
            type="date"
            value={dateRange.from}
            onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            className="border p-1"
          />
          <span className="self-center">→</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            className="border p-1"
          />
        </div>
        <input type="file" onChange={e => setFileBC(e.target.files[0])} />
        <button
          className="mt-2 px-4 py-1 bg-green-600 text-white rounded"
          onClick={handleUploadBC}
        >
          Gửi Báo cáo tuần
        </button>
      </div>

      {message && <p className="text-center text-blue-700 font-medium mt-4">{message}</p>}
    </div>
  );
}
