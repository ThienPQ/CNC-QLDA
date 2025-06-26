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
          throw new Error(`Lỗi từ server: ${res.statusText}`);
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
      <h1>Xem Dữ Liệu Thô Từ Sheet "{excelData?.sheetName}"</h1>
      <p>Đây là chính xác những gì server đọc được từ file Excel của bạn.</p>
      <hr />
      {loading && <p>Đang tải và đọc file Excel từ Cloudinary...</p>}
      {error && <p style={{ color: 'red' }}>Lỗi: {error}</p>}
      {excelData && (
        <table border="1" cellPadding="5" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {excelData.data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} style={{ border: '1px solid #ccc', verticalAlign: 'top' }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}