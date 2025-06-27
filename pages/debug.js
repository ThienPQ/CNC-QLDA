// pages/debug.js
import { useEffect, useState } from 'react';

export default function DebugPage() {
  const [excelData, setExcelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/debug-excel')
      .then(res => {
        if (!res.ok) {
          return res.json().then(errData => {
            throw new Error(`Lỗi từ server: ${res.status} - ${errData.error || res.statusText}`);
          });
        }
        return res.json();
      })
      .then(data => {
        setExcelData(data);
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', fontSize: '12px' }}>
      <h1>Xem Dữ Liệu Thô Từ Sheet "{excelData?.sheetName || '...'}"</h1>
      <p style={{ color: 'red', fontWeight: 'bold' }}>Đây là chính xác 100% những gì server đọc được từ file PLHD.xlsx trên Cloudinary.</p>
      <hr />
      {loading && <p>Đang tải và đọc file Excel từ Cloudinary...</p>}
      {error && <p style={{ color: 'red', border: '1px solid red', padding: '10px' }}>LỖI: {error}</p>}
      {excelData && (
        <>
            <p style={{ color: 'blue', fontWeight: 'bold' }}>Vui lòng chụp ảnh màn hình của bảng dữ liệu dưới đây, đặc biệt là các dòng tiêu đề, và gửi lại cho tôi.</p>
            <table border="1" cellPadding="5" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
                {excelData.data.map((row, rowIndex) => (
                <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                    <td key={cellIndex} style={{ border: '1px solid #ccc', verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>
                        {cell === null ? '[null]' : String(cell)}
                    </td>
                    ))}
                </tr>
                ))}
            </tbody>
            </table>
        </>
      )}
    </div>
  );
}