// Khởi động CẢ 4 app dev bằng 1 lệnh: npm run dev:all
// - wms (desktop) :3000  ·  thukho :3003  ·  xenang :3002  ·  kiemke :3004
// Không cần cài thêm package. Ctrl+C sẽ tắt cả 4.
//
// Mỗi app là 1 tiến trình `next dev` riêng với BASE_PATH tương ứng (kiến trúc 4 app
// cùng nguồn của dự án). Log gộp về 1 cửa sổ, có nhãn [tên:cổng] màu để phân biệt.
import { spawn } from "node:child_process";

const RESET = "\x1b[0m";
const APPS = [
  { name: "wms",    basePath: "/wms",    port: 3000, color: "\x1b[36m" }, // cyan
  { name: "thukho", basePath: "/thukho", port: 3003, color: "\x1b[32m" }, // green
  { name: "xenang", basePath: "/xenang", port: 3002, color: "\x1b[33m" }, // yellow
  { name: "kiemke", basePath: "/kiemke", port: 3004, color: "\x1b[35m" }, // magenta
];

const isWin = process.platform === "win32";
const children = [];

console.log("\nKhởi động 4 app dev (Ctrl+C để tắt tất cả):");
for (const a of APPS) {
  console.log(`  ${a.color}[${a.name}]${RESET} http://localhost:${a.port}${a.basePath}/auth`);
}
console.log("");

for (const a of APPS) {
  // Dùng npx next dev để không phụ thuộc đường dẫn nhị phân theo OS.
  const child = spawn("npx", ["next", "dev", "-p", String(a.port)], {
    env: { ...process.env, BASE_PATH: a.basePath },
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const prefix = `${a.color}[${a.name}:${a.port}]${RESET} `;
  const pipe = (stream, out) => {
    let buf = "";
    stream.on("data", (chunk) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) out.write(prefix + line + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on("exit", (code) => {
    process.stdout.write(`${prefix}đã dừng (code ${code}). Tắt các app còn lại...\n`);
    shutdown();
  });

  children.push(child);
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    if (c.pid == null) continue;
    try {
      if (isWin) {
        // Windows: kill cả cây tiến trình (cmd → npx → next)
        spawn("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        c.kill("SIGTERM");
      }
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
