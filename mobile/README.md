# WMS Mobile (Expo)

Native app cho 3 vai trò tác nghiệp tại sàn kho:
- **Thủ kho** — tạo + cập nhật + xác nhận pallet, tiếp nhận PHN, nhập đột xuất
- **Xe nâng** — xem pallet chờ xếp, putaway, FEFO pick → khu chờ xuất
- **Người kiểm kê** — phiên kiểm kê theo vị trí + theo SKU

## Setup

```bash
cp .env.example .env
npm install
npx expo start             # mở Expo Dev Tools
# scan QR bằng Expo Go app trên Android/iOS
# hoặc: npm run android / npm run ios
```

## Cấu trúc

```
mobile/
├── app/                          # Expo Router file-based routing
│   ├── _layout.tsx               # root (QueryClient + Auth provider + SafeArea)
│   ├── index.tsx                 # gate: redirect tới /login hoặc /(tabs)/home
│   ├── login.tsx
│   └── (tabs)/                   # protected — bottom tabs role-aware
│       ├── _layout.tsx           # tab list khác nhau theo role
│       ├── home.tsx              # dashboard mỗi role
│       ├── pallets/              # Thủ kho
│       ├── inbound/              # Thủ kho
│       ├── forklift/             # Xe nâng
│       ├── stocktake/            # Người kiểm kê
│       └── profile.tsx
├── src/
│   ├── api/                      # api-client + TanStack Query hooks
│   ├── auth/                     # secure-store + auth-store
│   ├── components/               # ScreenContainer, TopBar, Card, Button…
│   ├── theme/                    # colors + spacing tokens
│   └── utils/
├── app.json                      # Expo config + permissions
└── package.json
```

## API target

`EXPO_PUBLIC_API_URL` trỏ tới `http://localhost:3001/v1` khi dev cùng máy.
Khi build APK / install qua Expo Go từ máy khác, đổi thành IP LAN của máy
chạy backend, vd `http://192.168.1.10:3001/v1`. CORS backend đã whitelist
`localhost` — cần thêm IP LAN vào `CORS_ORIGINS` env.

## Permissions

- **Camera** — UC-PAL-03 (quét mã hàng), UC-INV-06 (quét vị trí), UC-FK-04
- **Image library** — UC-INTMP-01 (đính kèm chứng từ)

Quyền được yêu cầu lần đầu user gọi flow tương ứng — không yêu cầu khi mở app.

## Tài khoản test (seed sẵn ở backend)

| Role | Email | Tab nào |
|---|---|---|
| Thủ kho | keeper@vinhgiang.local | Pallet · Phiếu nhập |
| Xe nâng | forklift@vinhgiang.local | Pending · FEFO pick · Lịch sử |
| Người kiểm kê | stocktaker@vinhgiang.local | Phiên kiểm kê |

Password: `Admin@123`.
