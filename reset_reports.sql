-- XÓA BẢNG CŨ (NẾU CÓ)
DROP TABLE IF EXISTS reports;

-- TẠO BẢNG MỚI LƯU CHI TIẾT THEO HẠNG MỤC
CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stt TEXT,
  ten_hang_muc TEXT,
  don_vi TEXT,
  khoi_luong_thuc_hien REAL,
  ghi_chu TEXT,
  fromDate TEXT,
  toDate TEXT
);
