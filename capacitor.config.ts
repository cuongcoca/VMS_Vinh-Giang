import type { CapacitorConfig } from "@capacitor/cli";

// App vỏ (WebView) trỏ THẲNG tới web Test — không nhúng Next vào app, luôn theo server.
// Đổi server.url khi build cho môi trường khác (Prod).
const config: CapacitorConfig = {
  appId: "vn.vinhgiang.wms",
  appName: "Vĩnh Giang WMS",
  webDir: "mobile-shell", // placeholder — thực tế nạp server.url
  server: {
    url: "https://khovinhgiang.lptech.info.vn/wms",
    cleartext: false,
    // Cho WebView ở-lại-trong-app khi điều hướng trong domain (login → /thukho, /xenang…).
    allowNavigation: ["khovinhgiang.lptech.info.vn"],
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
