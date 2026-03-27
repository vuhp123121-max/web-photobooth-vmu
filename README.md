# Photobooth Cover

Ứng dụng photobooth chạy trực tiếp trên trình duyệt bằng HTML, CSS và JavaScript thuần. Dự án cho phép mở camera, chụp ảnh tự động, ghép vào template có sẵn, xuất ảnh hoàn chỉnh, upload lên Cloudinary và tạo mã QR để người dùng tải ảnh về.

## Tính năng

- Giao diện photobooth một trang, không cần framework.
- Mở webcam trực tiếp từ trình duyệt.
- Tự động đếm ngược trước khi chụp.
- Hỗ trợ 2 layout:
  - `strip`: chụp 3 ảnh liên tiếp.
  - `circle`: chụp 1 ảnh với bố cục tròn.
- Chuyển qua lại giữa các template bằng nút điều hướng.
- Xuất ảnh PNG chất lượng cao từ canvas.
- Upload ảnh lên Cloudinary.
- Tạo QR code để quét và tải ảnh sau khi in/xuất.
- Có hiệu ứng flash, âm thanh chụp ảnh và hiệu ứng trang trí.

## Cấu trúc thư mục

```text
photobooth_cover-main/
├─ assets/          # template, icon, ảnh trang trí, âm thanh
├─ index.html       # cấu trúc giao diện
├─ style.css        # giao diện và animation
├─ script.js        # camera, chụp ảnh, render canvas, upload, QR
└─ README.md
```

## Cách chạy

Vì dự án dùng `navigator.mediaDevices.getUserMedia()`, bạn nên chạy bằng `localhost` hoặc `HTTPS`. Mở file HTML trực tiếp bằng `file://` thường sẽ không dùng được camera.

### Cách 1: dùng VS Code Live Server

1. Mở thư mục dự án trong VS Code.
2. Cài extension `Live Server` nếu chưa có.
3. Chuột phải vào `index.html` và chọn `Open with Live Server`.

### Cách 2: chạy server tĩnh bằng terminal

Nếu máy có Python:

```bash
python -m http.server 5500
```

Sau đó mở:

```text
http://localhost:5500
```

## Cách sử dụng

1. Mở ứng dụng.
2. Nhấn `START`.
3. Cho phép trình duyệt truy cập camera.
4. Chọn template bằng nút trái/phải nếu cần.
5. Nhấn `CAPTURE`.
6. Với layout `strip`, ứng dụng sẽ chụp 3 ảnh liên tiếp.
7. Với layout `circle`, ứng dụng sẽ chụp 1 ảnh.
8. Nhấn `DOWNLOAD` để render ảnh hoàn chỉnh, upload và tạo QR code.
9. Quét QR để tải ảnh.

## Cấu hình quan trọng

### 1. Cloudinary

Trong `script.js` hiện đang có cấu hình:

```js
const CLOUD_NAME = "dqbi4wztz";
const UPLOAD_PRESET = "photobooth";
```

Nếu bạn dùng tài khoản Cloudinary khác, hãy thay 2 giá trị này bằng cấu hình của riêng bạn.

Lưu ý:

- `upload_preset` phải là preset cho phép upload từ client.
- Vì cấu hình đang nằm ở frontend, chỉ nên dùng preset giới hạn quyền phù hợp.

### 2. Template ảnh

Danh sách template đang được khai báo trong `script.js`:

```js
const TEMPLATES_STRIP = [
  "assets/2_2.png",
  "assets/anh4_demo.png",
  "assets/anh5new2.png",
  "assets/dacoten.png",
];

const TEMPLATES_CIRCLE = [
  "assets/template4.png",
  "assets/template5.png",
];
```

Bạn có thể:

- thêm file ảnh mới vào thư mục `assets/`
- cập nhật mảng template tương ứng trong `script.js`

## Yêu cầu trình duyệt

- Chrome, Edge hoặc trình duyệt hiện đại có hỗ trợ webcam.
- Quyền truy cập camera phải được bật.
- Nên dùng máy có webcam ngoài hoặc webcam chất lượng tốt để ảnh sắc nét hơn.

## Ghi chú kỹ thuật

- Dự án không cần bước build.
- QR code được tạo bằng thư viện CDN:

```html
https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js
```

- Ảnh cuối được render bằng `canvas` rồi xuất ra dạng `image/png`.
- App có cơ chế thử nhiều cấu hình camera để tăng khả năng tương thích thiết bị.

## Hướng phát triển thêm

- Thêm chọn camera trực tiếp trên giao diện.
- Thêm nút tải ảnh ngay trên máy ngoài QR code.
- Thêm nhiều layout/template hơn.
- Thêm bộ lọc màu hoặc khung theo sự kiện.
- Tách cấu hình ra file riêng để dễ triển khai.

## Tác giả

Tiêu đề trang hiện tại là `Photobooth by Vector`.
