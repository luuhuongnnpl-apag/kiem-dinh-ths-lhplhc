# CSDL minh chứng – Tự đánh giá CTĐT thạc sĩ ngành Luật Hiến pháp và Luật Hành chính

Trang web để Hội đồng tự đánh giá, Ban Thư ký và các nhóm công tác cùng tải và quản lý minh chứng theo
Thông tư 04/2025/TT-BGDĐT (8 tiêu chuẩn, 52 tiêu chí, 10 tiêu chí điều kiện). Giai đoạn đánh giá 01/9/2023 – 30/8/2026.

**Kiến trúc:** GitHub Pages (giao diện) + Firebase dự án `phuc-nguyen-library` (đăng nhập Google, Firestore lưu danh mục)
+ Google Drive (lưu tệp, trong thư mục `MINH CHUNG - TDG CTDT ThS LHP&LHC` của quản trị).

## Tệp
- `index.html`, `app.js` – giao diện và chức năng; `config.js` – cấu hình công khai
- `data/seed.json` – 52 tiêu chí (yêu cầu, minh chứng gợi ý theo Phụ lục II), 15 văn bản căn cứ, 257 minh chứng gợi ý mã Hn.ab.cd.ef
- `vanban.js` – đọc PDF có lớp chữ/Word trên trình duyệt, trích số hiệu, ngày, cơ quan ban hành, trích yếu; `vendor/` – pdf.js 3.11.174 (Apache-2.0), mammoth 1.6.0 (BSD-2)
- `firebase/kd.rules` – khối quy tắc Firestore `KDTHS`, được trang tự chèn vào quy tắc chung (giữ nguyên PNL, PNW, PND)

## Lần đầu (quản trị)
1. Mở trang, đăng nhập Google bằng tài khoản quản trị → tab **Cài đặt**.
2. **Cập nhật quy tắc** (chọn tài khoản Google đã tạo dự án Firebase).
3. **Khởi tạo** → tạo thư mục Drive (gốc, căn cứ, 8 tiêu chuẩn, 52 tiêu chí) và nạp dữ liệu.
4. Tab **Thành viên**: dán danh sách `email | Họ và tên | vai | nhóm` → hệ thống tự chia sẻ thư mục Drive.

## Vai trò
| Vai | Xem | Tải lên, thêm văn bản, sửa | Rà soát, thêm minh chứng, gỡ/xóa, quản lý thành viên |
|---|---|---|---|
| `xem` | ✓ | | |
| `thanhvien` | ✓ | ✓ | |
| `thuky` / quản trị | ✓ | ✓ | ✓ |

Firestore: `kd_kho` (kho chung), `kd_cfg`, `kd_tc`, `kd_cc`, `kd_mc`, `kd_tv`, `kd_log`, `kd_rules_v`. Đổi quy tắc thì tăng số phiên bản ở
`firebase/kd.rules` và `config.js` (RULES_V), rồi bấm lại **Cập nhật quy tắc**.
