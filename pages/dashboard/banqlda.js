import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

const TENTUYEN = ['CT.3', 'CT.4', 'CT.5', 'Nội khu'];

export default function BanQLDAPage() {
  const router = useRouter();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [tuyenData, setTuyenData] = useState(
    TENTUYEN.map((name) => ({
      tenTuyen: name,
      khoiLuong: '',
      tienDo: '',
      giaTriThanhToan: '',
      ghiChu: ''
    }))
  );
  const [message, setMessage] = useState('');

  const handleChange = (index, field, value) => {
    const updated = [...tuyenData];
    updated[index][field] = value;
    setTuyenData(updated);
  };

  const handleSave = async () => {
    if (!fromDate || !toDate) {
      alert('Vui lòng chọn ngày báo cáo');
      return;
    }

    try {
      const check = await axios.post('/api/check-duplicate-report', { fromDate, toDate });
      if (check.data.duplicate) {
        alert('Khoảng thời gian này đã tồn tại trong báo cáo!');
        return;
      }

      const res = await axios.post('/api/save-report', {
        fromDate,
        toDate,
        reports: tuyenData
      });

      if (res.data.success) {
        setMessage('Đã lưu báo cáo thành công');
      } else {
        alert('Lỗi khi lưu báo cáo');
      }
    } catch (error) {
      console.error(error);
      alert('Lỗi hệ thống');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Nhập báo cáo tiến độ</h2>

      <div className="flex gap-4 mb-4">
        <div>
          <label className="block font-semibold">Từ ngày:</label>
          <input
            type="date"
            className="border p-2 rounded"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block font-semibold">Đến ngày:</label>
          <input
            type="date"
            className="border p-2 rounded"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      <table className="w-full border mb-4">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Tuyến</th>
            <th className="border p-2">Khối lượng</th>
            <th className="border p-2">Tiến độ lũy kế (%)</th>
            <th className="border p-2">Giá trị thanh toán</th>
            <th className="border p-2">Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {tuyenData.map((row, idx) => (
            <tr key={row.tenTuyen}>
              <td className="border p-2">{row.tenTuyen}</td>
              <td className="border p-2">
                <input
                  type="text"
                  value={row.khoiLuong}
                  onChange={(e) => handleChange(idx, 'khoiLuong', e.target.value)}
                  className="w-full border rounded px-2"
                />
              </td>
              <td className="border p-2">
                <input
                  type="number"
                  value={row.tienDo}
                  onChange={(e) => handleChange(idx, 'tienDo', e.target.value)}
                  className="w-full border rounded px-2"
                />
              </td>
              <td className="border p-2">
                <input
                  type="text"
                  value={row.giaTriThanhToan}
                  onChange={(e) => handleChange(idx, 'giaTriThanhToan', e.target.value)}
                  className="w-full border rounded px-2"
                />
              </td>
              <td className="border p-2">
                <input
                  type="text"
                  value={row.ghiChu}
                  onChange={(e) => handleChange(idx, 'ghiChu', e.target.value)}
                  className="w-full border rounded px-2"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={handleSave}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
      >
        Lưu báo cáo
      </button>

      {message && <p className="mt-4 text-green-600">{message}</p>}
    </div>
  );
}
