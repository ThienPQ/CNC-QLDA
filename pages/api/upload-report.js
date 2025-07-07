import React, { useState } from "react";

export default function BanQLDA() {
  const [contractFile, setContractFile] = useState(null);
  const [reportFile, setReportFile] = useState(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);

  // Hiện popup lỗi chi tiết
  const showError = (title, error, details) => {
    let msg = error ? error : "Lỗi không xác định";
    if (details) msg += "\n\nChi tiết: " + details;
    alert(`${title}\n\n${msg}`);
  };

  const handleContractChange = (e) => {
    setContractFile(e.target.files[0]);
  };

  const handleReportChange = (e) => {
    setReportFile(e.target.files[0]);
  };

  const handleUploadContract = async () => {
    if (!contractFile) {
      alert("Chưa chọn file hợp đồng!");
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append("file", contractFile);
    try {
      const res = await fetch("/api/upload-contract", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        showError("Lỗi tải hợp đồng", data.error, data.details);
      } else {
        alert("Tải file hợp đồng thành công!");
        setContractFile(null);
      }
    } catch (e) {
      showError("Lỗi tải hợp đồng", e.message);
    }
    setLoading(false);
  };

  const handleUploadReport = async () => {
    if (!reportFile || !fromDate || !toDate) {
      alert("Vui lòng chọn file báo cáo tuần và nhập đủ ngày!");
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append("file", reportFile);
    formData.append("from_date", fromDate);
    formData.append("to_date", toDate);
    try {
      const res = await fetch("/api/upload-report", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        showError("Lỗi khi tải báo cáo tuần", data.error, data.details);
      } else {
        alert("Tải báo cáo tuần thành công!");
        setReportFile(null);
      }
    } catch (e) {
      showError("Lỗi tải báo cáo tuần", e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontWeight: "bold", fontSize: 32 }}>Tải lên Hợp đồng (PLHD.xlsx)</h1>
      <div style={{ marginBottom: 16 }}>
        <input type="file" onChange={handleContractChange} accept=".xlsx,.xls" />
        <button onClick={handleUploadContract} disabled={loading}>
          Gửi Hợp đồng
        </button>
      </div>
      <h1 style={{ fontWeight: "bold", fontSize: 32 }}>Tải lên Báo cáo Tuần</h1>
      <div style={{ marginBottom: 16 }}>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <input type="file" onChange={handleReportChange} accept=".xlsx,.xls,.csv" />
        <button onClick={handleUploadReport} disabled={loading}>
          Gửi Báo cáo Tuần
        </button>
      </div>
      {loading && <p style={{ color: "#d17700" }}>Đang tải lên...</p>}
    </div>
  );
}
