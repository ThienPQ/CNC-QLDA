import pandas as pd
import re

# Đọc PLHD.xlsx (bạn đổi lại đúng tên file nếu cần)
df = pd.read_excel('PLHD.xlsx', sheet_name=0, engine='openpyxl')

rows = []
current_group_code = ""
current_group_name = ""

for idx, row in df.iterrows():
    stt = str(row['STT']).strip() if not pd.isnull(row['STT']) else ""
    desc = str(row['Mô tả công việc']).strip() if not pd.isnull(row['Mô tả công việc']) else ""
    unit = str(row['Đơn vị tính']).strip() if not pd.isnull(row['Đơn vị tính']) else ""
    qty = row['Khối lượng'] if not pd.isnull(row['Khối lượng']) else ""

    # Nhận diện hạng mục cha (dòng có chữ HẠNG MỤC và in hoa)
    if "HẠNG MỤC" in desc.upper():
        m = re.match(r"HẠNG MỤC\s*(\d+)\s*:?(.+)", desc, re.I)
        if m:
            current_group_code = m.group(1)
            current_group_name = m.group(2).strip(": ").strip().title()
        continue

    # Bỏ dòng header, dòng tổng kết, dòng trống
    if desc == "" or "đơn giá" in desc.lower() or "thành tiền" in desc.lower():
        continue

    # Nếu là dòng công việc (có STT dạng 1.1, 1.2...)
    if re.match(r"\d+(\.\d+)*[a-z]?$", stt):
        rows.append({
            "group_code": current_group_code,
            "group_name": current_group_name,
            "sub_code": stt,
            "task_name": desc,
            "unit": unit,
            "design_quantity": qty
        })

df_out = pd.DataFrame(rows)
df_out.to_csv("project_tasks_ready.csv", index=False, encoding='utf-8-sig')
print("Đã xuất file project_tasks_ready.csv với", len(df_out), "dòng.")
