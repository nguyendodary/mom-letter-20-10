# Một lá thư dành riêng cho mẹ

Website chúc mừng Ngày Phụ nữ Việt Nam 20/10/2026, làm riêng cho mẹ.
Một file HTML duy nhất, không cần backend, không cần database, không cần mạng sau khi tải trang.

## Nhạc nền

- Bản nhạc: **Chopin – Nocturne in E♭ major, Op. 9 No. 2** (piano solo, Andante ~66–70 BPM).
- Nguồn & giấy phép: bản thu **Public Domain** của Musopen, lưu tại `assets/music/chopin-nocturne-op9-no2.mp3`.
  Chi tiết nguồn gốc, giấy phép và đường dẫn tải: `assets/music/CREDITS.md`.
- **Mặc định tắt.** Người nhận phải chủ động bấm “Bật nhạc” thì trình duyệt mới tải file (không tải khi mở trang) và bắt đầu phát.
- Bật: âm lượng fade lên trong 1,6 giây. Tắt: fade xuống rồi mới dừng. Mỗi vòng lặp được fade mềm ở đầu/cuối nên không bị cụt.
- Chỉ dùng **một** thẻ `<audio>` duy nhất — bật/tắt liên tục không tạo tiếng chồng nhau.
- Có thanh chỉnh âm lượng (lưu lại trong `localStorage`), `aria-label`/`aria-pressed` đầy đủ.
- Tab bị ẩn → nhạc tắt dần và dừng; quay lại tab thì tiếp tục nếu người dùng vẫn đang bật.
- Nút nhạc trên màn hình lá thư và trên thanh công cụ khi đọc thư luôn đồng bộ trạng thái.
- Nếu file nhạc lỗi / không tải được: hiện ghi chú nhẹ, mọi chức năng khác vẫn chạy bình thường.

Đổi bản nhạc: thay file trong `assets/music/` và sửa `MUSIC.src` trong khối `const MUSIC = { ... }` của `index.html`.
Máy chủ local phục vụ `/assets/` kèm hỗ trợ HTTP Range nên phát nhạc trên điện thoại mượt.

## Công nghệ

- HTML5 + CSS3 + JavaScript thuần (không framework, không thư viện ngoài).
- Toàn bộ hình minh họa (phong thư, con dấu trái tim, hoa hồng, cánh hoa, lá thư) được vẽ bằng **HTML/CSS/SVG nội tuyến** — không dùng ảnh từ Internet, không có phụ thuộc bản quyền.
- Font **Cormorant Garamond** và **Caveat** (SIL Open Font License) được **nhúng thẳng trong file** dưới dạng base64 nên trang hiển thị đúng ngay cả khi offline.
- Mỗi `@font-face` khai báo `unicode-range` theo từng subset (latin + vietnamese). **Chỉ dùng ký tự nằm trong các khoảng đó** — emoji hay ký tự như `♡`, `♫`, `→` nằm ngoài sẽ bị rơi sang font hệ thống, lệch kiểu hoặc hiện ô vuông. Hình trang trí (trái tim, hoa) luôn vẽ bằng SVG qua `<use href="#icon-...">`.

## Chạy thử trên máy

```powershell
node serve.js          # http://localhost:8000
```

Hoặc dùng bất kỳ static server nào:

```powershell
python -m http.server 8000
npx serve .
```

Máy chủ `serve.js` chỉ lắng nghe ở `127.0.0.1` (không mở cho mạng LAN), tự nén gzip và tự nạp lại khi bạn sửa `index.html`.

## Sửa nội dung

| Cần sửa | Tìm trong `index.html` theo |
| --- | --- |
| Toàn bộ lời chúc, lời mở đầu và lời kết | Khối `const LETTER = { ... }` — mảng `paragraphs` là từng đoạn văn |
| Lời chào đầu thư | `LETTER.greeting` |
| Chữ ký cuối thư | `LETTER.signature` và `LETTER.closing` (khối trên). Hình tim cạnh chữ ký là SVG riêng, không nằm trong chuỗi |
| Ngày tháng | `LETTER.date` (hiển thị ở đầu lá thư) + dòng `20 tháng 10` trong màn hình mở đầu |
| Lời nhắn sau khi bấm nút ôm | `LETTER.hugMessage` |
| Nhãn nút ôm / nút đọc lại | `LETTER.hugButton`, `LETTER.replayButton` |
| Màu sắc | Khối `:root { ... }` ở đầu file: `--cream`, `--blush`, `--rose`, `--burgundy`, `--ink`, `--gold` |
| Nội dung màn hình mở đầu | `<div class="intro__content">` |

Không dùng số dòng để định vị — chúng đổi mỗi lần sửa file.

Sửa xong chỉ cần bấm F5 trên trình duyệt.

## Đưa lên Internet (tạm thời)

```powershell
cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8000
```

URL `*.trycloudflare.com` **chỉ sống khi tiến trình `cloudflared` còn chạy**, và sẽ đổi mỗi lần khởi động lại. Giữ cửa sổ terminal mở trong suốt thời gian mẹ xem.

## Đưa lên Internet (lâu dài)

Trang này là site tĩnh, nên có thể đăng lên GitHub Pages miễn phí: đẩy `index.html` lên nhánh `main` của một repository public rồi bật **Settings → Pages → Source: Deploy from a branch → `main` / root**.

## Ghi chú kỹ thuật

- Hỗ trợ `prefers-reduced-motion` (tự tắt animation khi hệ điều hành yêu cầu).
- Có `aria-label`, `aria-live`, `inert`, hỗ trợ bàn phím và vùng chạm ≥ 44px.
- Không tự phát nhạc, không popup, không quảng cáo, không theo dõi người dùng, không gửi dữ liệu ra ngoài.
