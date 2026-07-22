#!/usr/bin/env node
/**
 * VPS Sync — Deploy code WMS Vĩnh Giang lên VPS công ty
 * Sử dụng ssh2 library với password auth
 * 
 * VPS công ty: 42.96.16.197 (khohangvinhgiang.io.vn)
 * Auth: Password từ env COMPANY_VPS_PASSWORD
 * 
 * Usage:
 *   node vps-sync.js full          # Backup → Pull → Install → Prisma → Build → Restart → Verify
 *   node vps-sync.js pull          # Chỉ pull code mới nhất
 *   node vps-sync.js install       # Chỉ npm ci
 *   node vps-sync.js prisma        # Chỉ sync database schema
 *   node vps-sync.js build         # Chỉ build Next.js (cả WMS + Xe nâng)
 *   node vps-sync.js build-wms     # Chỉ build WMS Admin
 *   node vps-sync.js build-xenang  # Chỉ build Xe nâng
 *   node vps-sync.js restart       # Chỉ restart PM2
 *   node vps-sync.js status        # Xem PM2 status
 *   node vps-sync.js backup        # Backup database trước khi deploy
 *   node vps-sync.js logs          # Xem PM2 logs gần nhất
 *   node vps-sync.js cmd "..."     # Chạy lệnh tùy ý trên VPS công ty
 * 
 * Env: COMPANY_VPS_PASSWORD (bắt buộc)
 */

const { Client } = require(process.env.SSH2_PATH || 'ssh2');

const COMPANY_VPS = {
  host: '42.96.16.197',
  port: 22,
  username: 'root',
  password: process.env.COMPANY_VPS_PASSWORD,
  readyTimeout: 30000,
};

const PROJECT_DIR = '/var/www/wms-vinhgiang';
const GIT_BRANCH = 'main';

// ─── Command definitions ─────────────────────────────────────────────────────

const COMMANDS = {
  pull: `cd ${PROJECT_DIR} && git fetch origin && git checkout ${GIT_BRANCH} && git pull origin ${GIT_BRANCH}`,
  install: `cd ${PROJECT_DIR} && npm ci --no-audit --no-fund`,
  prisma: `cd ${PROJECT_DIR} && npx prisma db push && npx prisma generate`,
  'prisma-generate': `cd ${PROJECT_DIR} && npx prisma generate`,
  'build-wms': `cd ${PROJECT_DIR} && BASE_PATH=/wms npm run build`,
  'build-xenang': `cd ${PROJECT_DIR} && BASE_PATH=/xenang npm run build`,
  'build-thukho': `cd ${PROJECT_DIR} && BASE_PATH=/thukho npm run build`,
  'build-kiemke': `cd ${PROJECT_DIR} && BASE_PATH=/kiemke npm run build`,
  build: `cd ${PROJECT_DIR} && BASE_PATH=/wms npm run build && BASE_PATH=/xenang npm run build && BASE_PATH=/thukho npm run build && BASE_PATH=/kiemke npm run build`,
  restart: `pm2 restart wms-vinhgiang && pm2 restart wms-xenang && pm2 restart wms-thukho && pm2 restart wms-kiemke && pm2 save`,
  status: `pm2 list`,
  logs: `pm2 logs --lines 50 --nostream`,
  backup: `cd ${PROJECT_DIR} && mkdir -p backups && pg_dump -U wms_user -d wms_vinhgiang | gzip > backups/wms-$(date +%Y%m%d-%H%M).sql.gz && ls -la backups/*.sql.gz | tail -5`,
  verify: `pm2 list && echo '---' && curl -s -o /dev/null -w 'WMS HTTP: %{http_code}\\n' http://127.0.0.1:4200/wms && curl -s -o /dev/null -w 'Xenang HTTP: %{http_code}\\n' http://127.0.0.1:3002/xenang && curl -s -o /dev/null -w 'Thukho HTTP: %{http_code}\\n' http://127.0.0.1:3003/thukho && curl -s -o /dev/null -w 'Kiemke HTTP: %{http_code}\\n' http://127.0.0.1:3004/kiemke`,
};

// Full deploy steps — mỗi build là 1 SSH connection riêng tránh timeout khi build lâu
const FULL_STEPS = [
  { key: 'backup',       label: '💾 Step 1/10: Backup Database' },
  { key: 'pull',         label: '📥 Step 2/10: Pull Code' },
  { key: 'install',     label: '📦 Step 3/10: Install Dependencies' },
  { key: 'prisma',       label: '🗄️  Step 4/10: Sync Database Schema' },
  { key: 'build-wms',   label: '🔨 Step 5/10: Build WMS Admin (/wms)' },
  { key: 'build-xenang', label: '🔨 Step 6/10: Build Xe nâng (/xenang)' },
  { key: 'build-thukho', label: '🔨 Step 7/10: Build Thủ kho (/thukho)' },
  { key: 'build-kiemke', label: '🔨 Step 8/10: Build Kiểm kê (/kiemke)' },
  { key: 'restart',     label: '🔄 Step 9/10: Restart PM2 Processes' },
  { key: 'verify',       label: '✅ Step 10/10: Verify Deployment' },
];

// ─── SSH execution ────────────────────────────────────────────────────────────

function runSSH(cmd, label) {
  return new Promise((resolve, reject) => {
    if (!COMPANY_VPS.password) {
      reject(new Error(
        'COMPANY_VPS_PASSWORD env var not set.\n' +
        'Set it before running:\n' +
        '  PowerShell: $env:COMPANY_VPS_PASSWORD = "your_password"\n' +
        '  CMD:        set COMPANY_VPS_PASSWORD=your_password\n' +
        '  node vps-sync.js <action>'
      ));
      return;
    }

    const conn = new Client();
    let stdout = '';
    let stderr = '';

    conn
      .on('ready', () => {
        if (label) {
          console.log(`\n${'='.repeat(60)}`);
          console.log(`  ${label}`);
          console.log(`${'='.repeat(60)}`);
          console.log(`  → ${cmd.substring(0, 120)}${cmd.length > 120 ? '...' : ''}\n`);
        }

        conn.exec(cmd, { pty: false }, (err, stream) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }
          stream
            .on('close', (code) => {
              conn.end();
              if (code !== 0) {
                console.error(`  ❌ Exit code: ${code}`);
                reject(new Error(`Command failed with exit code ${code}`));
              } else {
                if (label) console.log(`  ✅ Done`);
                resolve(stdout);
              }
            })
            .on('data', (data) => {
              stdout += data.toString();
              process.stdout.write(data);
            })
            .stderr.on('data', (data) => {
              stderr += data.toString();
              process.stderr.write(data);
            });
        });
      })
      .on('error', (err) => {
        console.error(`  ❌ SSH Connection error: ${err.message}`);
        reject(err);
      })
      .connect(COMPANY_VPS);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const action = process.argv[2] || 'status';

  console.log(`\n🚀 VPS Sync — WMS Vĩnh Giang`);
  console.log(`   Target:  ${COMPANY_VPS.host} (khohangvinhgiang.io.vn)`);
  console.log(`   Action:  ${action}`);
  console.log(`   Auth:    Password (ssh2)`);
  console.log(`   Time:    ${new Date().toISOString()}\n`);

  try {
    if (action === 'full') {
      for (const step of FULL_STEPS) {
        // Bước backup không bắt buộc — lỗi backup không dừng deploy
        if (step.key === 'backup') {
          try {
            await runSSH(COMMANDS[step.key], step.label);
          } catch (backupErr) {
            console.warn(`  ⚠️  Backup thất bại (bỏ qua): ${backupErr.message}`);
          }
          continue;
        }
        await runSSH(COMMANDS[step.key], step.label);
      }
      console.log(`\n${'='.repeat(60)}`);
      console.log(`  🎉 Full deployment complete!`);
      console.log(`  🌐 Check: https://khohangvinhgiang.io.vn/wms`);
      console.log(`${'='.repeat(60)}\n`);
    } else if (action === 'cmd') {
      const customCmd = process.argv.slice(3).join(' ');
      if (!customCmd) {
        console.error('Usage: node vps-sync.js cmd "your command here"');
        process.exit(1);
      }
      await runSSH(customCmd, '🔧 Custom Command');
    } else if (COMMANDS[action]) {
      const labels = {
        pull: '📥 Pull Code',
        install: '📦 Install Dependencies',
        prisma: '🗄️ Sync Database Schema',
        'prisma-generate': '🗄️ Generate Prisma Client',
        build: '🔨 Build Next.js (tất cả)',
        'build-wms': '🔨 Build WMS Admin',
        'build-xenang': '🔨 Build Xe nâng',
        'build-thukho': '🔨 Build Thủ kho',
        'build-kiemke': '🔨 Build Kiểm kê',
        restart: '🔄 Restart PM2',
        status: '📊 PM2 Status',
        logs: '📋 PM2 Logs',
        backup: '💾 Backup Database',
        verify: '✅ Verify',
      };
      await runSSH(COMMANDS[action], labels[action] || action);
    } else {
      console.error(`Unknown action: ${action}`);
      console.error('Available: full, pull, install, prisma, prisma-generate, build, build-wms, build-xenang, restart, status, logs, backup, verify, cmd');
      process.exit(1);
    }
  } catch (err) {
    console.error(`\n❌ Deployment failed: ${err.message}`);
    process.exit(1);
  }
}

main();
