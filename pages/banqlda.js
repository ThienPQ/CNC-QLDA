import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

const TENTUYEN = ['CT.3', 'CT.4', 'CT.5', 'Nội khu'];

export default function BanQLDA() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState(
    TENTUYEN.map((tenTuyen) => ({
      tenTuyen,
      khoiLuong: '',
      tienDo: '',
      giaTriThanhToan: '',
      ghiChu: '',
    }))
  );
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleChange = (index, field, value) => {
    const newData = [...data];
    newData[index][field] = value;
    setData(newData);
  };

  const handleSubmit = async () => {
    setMessage('');
    setError('');
    try {
      const res = await axios.post('/api/check-duplicate-report', { fromDate, toDate });
      if (res.data.exists) {
        setError('Dữ liệu đã tồn tại cho khoảng thời gian này.');
        return;
      }
      await axios.post('/api/save-report', { fromDate, toDate, data });
      setMessage('Đã lưu báo cáo thành công!');
    } catch (err) {
      console.error('Lỗi khi lưu báo cáo:', err);
      setError('Đã xảy ra lỗi khi lưu dữ liệu.');
    }
  };

  return (
    <div>
      <h1>BAN QLDA - Nhập báo cáo</h1>
      <div>
        <label>Từ ngày: <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></label>
        <label>Đến ngày: <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></label>
      </div>
      <table border="1">
        <thead>
          <tr>
            <th>Tuyến</th>
            <th>Khối lượng</th>
            <th>Tiến độ (%)</th>
            <th>Giá trị thanh toán</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {data.map((tuyen, index) => (
            <tr key={tuyen.tenTuyen}>
              <td>{tuyen.tenTuyen}</td>
              <td><input value={tuyen.khoiLuong} onChange={(e) => handleChange(index, 'khoiLuong', e.target.value)} /></td>
              <td><input value={tuyen.tienDo} onChange={(e) => handleChange(index, 'tienDo', e.target.value)} /></td>
              <td><input value={tuyen.giaTriThanhToan} onChange={(e) => handleChange(index, 'giaTriThanhToan', e.target.value)} /></td>
              <td><input value={tuyen.ghiChu} onChange={(e) => handleChange(index, 'ghiChu', e.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={handleSubmit}>Lưu</button>
      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
