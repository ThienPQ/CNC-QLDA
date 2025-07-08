// pages/banqlda.js
import { useState } from 'react';
import axios from 'axios';

export default function BanQLDA() {
  const [contractFile, setContractFile] = useState(null);
  const [reportFile, setReportFile] = useState(null);

  const uploadContract = async () => {
    if (!contractFile) return alert('Vui lòng chọn file hợp đồng');
    const form = new FormData();
    form.append('file', contractFile);

    try {
      await axios.post('/api/upload-contract', form);
      alert('Tải file hợp đồng thành công');
    } catch (error) {
      alert('Lỗi khi tải hợp đồng');
    }
  };

  const uploadWeeklyReport = async () => {
    if (!reportFile) return alert('Vui lòng chọn file báo cáo tuần');
    const form = new FormData();
    form.append('file', reportFile);

    try {
      await axios.post('/api/upload-weekly-report', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Tải báo cáo tuần thành công và đã import vào CSDL!');
    } catch (error) {
      alert('Lỗi khi tải báo cáo tuần');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Tải lên Hợp đồng (PLHD.xlsx)</h2>
      <input type="file" onChange={(e) => setContractFile(e.target.files[0])} />
      <button onClick={uploadContract}>Gửi Hợp đồng</button>

      <h2 style={{ marginTop: 40 }}>Tải lên Báo cáo Tuần</h2>
      <input type="file" onChange={(e) => setReportFile(e.target.files[0])} />
      <button onClick={uploadWeeklyReport}>Gửi Báo cáo Tuần</button>
    </div>
  );
}
