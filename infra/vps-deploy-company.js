#!/usr/bin/env node
/**
 * VPS Deploy — WMS Vĩnh Giang (VPS công ty 42.96.16.197 — khohangvinhgiang.io.vn)
 *
 * Dùng SSH private key trực tiếp (không cần ssh-agent).
 *
 * Usage:
 *   node vps-deploy.js test                            # Test connection + show project path
 *   node vps-deploy.js exec "<command>"                # Run any shell command
 *   node vps-deploy.js upload <local> <remote>         # Upload single file
 *   node vps-deploy.js upload-many <file1> <file2>...  # Upload nhiều file (giữ relative path)
 *   node vps-deploy.js sync-files <file1> ...          # Upload + auto detect target từ project root
 *   node vps-deploy.js pull                            # git pull trên VPS
 *   node vps-deploy.js migrate <local-sql>             # Upload + chạy SQL migration
 *   node vps-deploy.js prisma-generate                 # npx prisma generate
 *   node vps-deploy.js build <instance>                # Build 1 instance (wms|xenang|thukho|kiemke|all)
 *   node vps-deploy.js restart <instance>              # Restart PM2 (wms|xenang|thukho|kiemke|all)
 *   node vps-deploy.js status                          # PM2 list + git status
 *   node vps-deploy.js logs <instance> [lines]         # PM2 logs
 *   node vps-deploy.js verify                          # Curl health-check tất cả instance
 *   node vps-deploy.js full                            # pull → prisma-generate → build all → restart all → verify
 *
 * Env:
 *   VPS_SSH_KEY  — đường dẫn private key (mặc định: ~/.ssh/id_ed25519, fallback ~/.ssh/id_rsa)
 *
 * Cấu hình mặc định trỏ tới VPS công ty 42.96.16.197 (đường dẫn dự án /var/www/wms-vinhgiang).
 */

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const VPS = {
  host: '42.96.16.197',
  port: 22,
  username: 'root',
  password: process.env.VPS_PASSWORD,
};

// PROJECT_DIR sẽ override qua env VPS_PROJECT_DIR — chưa biết path thực
const PROJECT_DIR = process.env.VPS_PROJECT_DIR || '/var/www/wms-vinhgiang';
const GIT_BRANCH = process.env.VPS_GIT_BRANCH || 'main';
const LOCAL_PROJECT_ROOT = path.resolve(__dirname); // = D:/wms-vinhgiang_repo

const INSTANCES = ['wms', 'xenang', 'thukho', 'kiemke'];

// ─── KEY RESOLUTION ──────────────────────────────────────────────────────────

function resolvePrivateKey() {
  if (process.env.VPS_SSH_KEY && fs.existsSync(process.env.VPS_SSH_KEY)) {
    return fs.readFileSync(process.env.VPS_SSH_KEY);
  }
  const candidates = [
    path.join(os.homedir(), '.ssh', 'id_ed25519'),
    path.join(os.homedir(), '.ssh', 'id_rsa'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p);
    }
  }
  throw new Error('No SSH private key found. Set VPS_SSH_KEY or place key in ~/.ssh/id_ed25519 / id_rsa');
}

function newClient() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on('ready', () => resolve(conn))
      .on('error', (err) => reject(err))
      .connect({
        host: VPS.host,
        port: VPS.port,
        username: VPS.username,
        password: VPS.password,  // VPS công ty dùng password auth
        readyTimeout: 30000,
      });
  });
}

// ─── COMMANDS ────────────────────────────────────────────────────────────────

function exec(conn, cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    const showHeader = opts.label && opts.silent !== true;
    if (showHeader) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`▶ ${opts.label}`);
      console.log('─'.repeat(70));
    }

    conn.exec(cmd, { pty: false }, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream
        .on('close', (code) => {
          if (code !== 0) {
            if (showHeader) console.error(`  ✖ Exit ${code}`);
            const e = new Error(`Exit code ${code}`);
            e.stdout = stdout;
            e.stderr = stderr;
            e.code = code;
            return reject(e);
          }
          if (showHeader) console.log(`  ✔ Done`);
          resolve({ stdout, stderr });
        })
        .on('data', (data) => {
          stdout += data.toString();
          if (!opts.silent) process.stdout.write(data);
        })
        .stderr.on('data', (data) => {
          stderr += data.toString();
          if (!opts.silent) process.stderr.write(data);
        });
    });
  });
}

function downloadFile(conn, remote, local) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const localDir = path.dirname(local);
      if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
      sftp.fastGet(remote, local, (downErr) => {
        if (downErr) return reject(downErr);
        resolve();
      });
    });
  });
}

function uploadFile(conn, local, remote) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      // Đảm bảo thư mục đích tồn tại
      const remoteDir = path.posix.dirname(remote);
      const mkdirCmd = `mkdir -p '${remoteDir}'`;
      conn.exec(mkdirCmd, (mkErr, mkStream) => {
        if (mkErr) return reject(mkErr);
        mkStream
          .on('close', () => {
            sftp.fastPut(local, remote, (upErr) => {
              if (upErr) return reject(upErr);
              resolve();
            });
          })
          .on('data', () => {})
          .stderr.on('data', () => {});
      });
    });
  });
}

// ─── ACTIONS ─────────────────────────────────────────────────────────────────

async function actionTest() {
  const conn = await newClient();
  try {
    console.log(`Connected to ${VPS.username}@${VPS.host}\n`);
    const { stdout: hostname } = await exec(conn, 'hostname', { silent: true });
    const { stdout: uname } = await exec(conn, 'uname -a', { silent: true });
    const { stdout: dirInfo } = await exec(conn, `ls -la ${PROJECT_DIR} 2>&1 | head -20`, { silent: true });
    const { stdout: gitInfo } = await exec(conn, `cd ${PROJECT_DIR} && git branch --show-current && git log --oneline -5`, { silent: true });
    const { stdout: pm2Info } = await exec(conn, 'pm2 jlist 2>/dev/null | head -200 || echo "PM2 not running"', { silent: true });

    console.log('Hostname:', hostname.trim());
    console.log('System:  ', uname.trim());
    console.log(`\nProject path: ${PROJECT_DIR}`);
    console.log('Contents:');
    console.log(dirInfo);
    console.log('\nGit:');
    console.log(gitInfo);
    console.log('\nPM2 processes (raw jlist truncated):');
    console.log(pm2Info.length > 2000 ? pm2Info.slice(0, 2000) + '\n... (truncated)' : pm2Info);
  } finally {
    conn.end();
  }
}

async function actionExec(cmd) {
  const conn = await newClient();
  try {
    await exec(conn, cmd, { label: `exec: ${cmd.length > 80 ? cmd.slice(0, 80) + '…' : cmd}` });
  } finally {
    conn.end();
  }
}

async function actionUpload(local, remote) {
  const conn = await newClient();
  try {
    const abs = path.resolve(local);
    if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
    console.log(`Uploading ${abs} → ${remote}...`);
    await uploadFile(conn, abs, remote);
    console.log('✔ Uploaded');
  } finally {
    conn.end();
  }
}

async function actionDownload(remote, local) {
  // remote là Linux path tuyệt đối, KHÔNG resolve
  const conn = await newClient();
  try {
    const localAbs = path.resolve(local);
    console.log(`Downloading ${remote} → ${localAbs}...`);
    await downloadFile(conn, remote, localAbs);
    console.log('✔ Downloaded');
  } finally {
    conn.end();
  }
}

/**
 * sync-files: upload nhiều file, target = PROJECT_DIR + path tương đối so với LOCAL_PROJECT_ROOT.
 * VD: vps-deploy sync-files prisma/schema.prisma src/lib/foo.ts
 *   → /var/www/wms-vinhgiang/prisma/schema.prisma
 *   → /var/www/wms-vinhgiang/src/lib/foo.ts
 */
async function actionSyncFiles(files) {
  if (files.length === 0) {
    console.error('No files specified');
    process.exit(1);
  }
  const conn = await newClient();
  try {
    for (const f of files) {
      const abs = path.resolve(f);
      if (!fs.existsSync(abs)) {
        console.warn(`  ⚠ Skip (not found): ${f}`);
        continue;
      }
      const rel = path.relative(LOCAL_PROJECT_ROOT, abs).replace(/\\/g, '/');
      if (rel.startsWith('..')) {
        console.warn(`  ⚠ Skip (outside project): ${f}`);
        continue;
      }
      const remote = `${PROJECT_DIR}/${rel}`;
      console.log(`  → ${rel}`);
      await uploadFile(conn, abs, remote);
    }
    console.log(`\n✔ Uploaded ${files.length} file(s)`);
  } finally {
    conn.end();
  }
}

async function actionUploadMany(files) {
  return actionSyncFiles(files);
}

async function actionPull() {
  const conn = await newClient();
  try {
    await exec(conn, `cd ${PROJECT_DIR} && git fetch origin && git checkout ${GIT_BRANCH} && git pull origin ${GIT_BRANCH}`, {
      label: `git pull (${GIT_BRANCH})`,
    });
  } finally {
    conn.end();
  }
}

async function actionMigrate(localSql) {
  const abs = path.resolve(localSql);
  if (!fs.existsSync(abs)) throw new Error(`SQL file not found: ${abs}`);
  const conn = await newClient();
  try {
    const filename = path.basename(abs);
    const remote = `${PROJECT_DIR}/${filename}`;
    console.log(`Uploading ${filename}...`);
    await uploadFile(conn, abs, remote);

    // Backup trước
    await exec(conn, `cd ${PROJECT_DIR} && mkdir -p backups && pg_dump -U wms_user -d wms_vinhgiang | gzip > backups/pre-${filename}-$(date +%Y%m%d-%H%M).sql.gz && ls -la backups/ | tail -3`, {
      label: 'Backup database',
    });

    // Apply migration
    await exec(conn, `cd ${PROJECT_DIR} && PGPASSWORD=wms_password psql -U wms_user -d wms_vinhgiang -h 127.0.0.1 -f ${filename}`, {
      label: `Apply ${filename}`,
    });

    // Generate Prisma client
    await exec(conn, `cd ${PROJECT_DIR} && npx prisma generate`, {
      label: 'prisma generate',
    });
  } finally {
    conn.end();
  }
}

async function actionPrismaGenerate() {
  const conn = await newClient();
  try {
    await exec(conn, `cd ${PROJECT_DIR} && npx prisma generate`, { label: 'prisma generate' });
  } finally {
    conn.end();
  }
}

async function actionBuild(instance) {
  const targets = instance === 'all' ? INSTANCES : [instance];
  if (!targets.every((t) => INSTANCES.includes(t))) {
    throw new Error(`Invalid instance. Use one of: ${INSTANCES.join(', ')}, all`);
  }
  const conn = await newClient();
  try {
    for (const t of targets) {
      await exec(conn, `cd ${PROJECT_DIR} && BASE_PATH=/${t} npm run build`, {
        label: `Build /${t}`,
      });
    }
  } finally {
    conn.end();
  }
}

async function actionRestart(instance) {
  const targets = instance === 'all' ? INSTANCES : [instance];
  if (!targets.every((t) => INSTANCES.includes(t))) {
    throw new Error(`Invalid instance. Use one of: ${INSTANCES.join(', ')}, all`);
  }
  const conn = await newClient();
  try {
    const names = targets.map((t) => `wms-${t === 'wms' ? 'vinhgiang' : t}`).join(' ');
    await exec(conn, `pm2 restart ${names} && pm2 save`, { label: `Restart PM2: ${names}` });
  } finally {
    conn.end();
  }
}

async function actionStatus() {
  const conn = await newClient();
  try {
    await exec(conn, 'pm2 list', { label: 'PM2 list' });
    await exec(conn, `cd ${PROJECT_DIR} && git status --short && echo "---" && git log --oneline -5`, { label: 'Git status' });
  } finally {
    conn.end();
  }
}

async function actionLogs(instance, lines = 50) {
  if (!INSTANCES.includes(instance)) {
    throw new Error(`Invalid instance. Use one of: ${INSTANCES.join(', ')}`);
  }
  const name = `wms-${instance === 'wms' ? 'vinhgiang' : instance}`;
  const conn = await newClient();
  try {
    await exec(conn, `pm2 logs ${name} --lines ${lines} --nostream`, { label: `Logs ${name}` });
  } finally {
    conn.end();
  }
}

async function actionVerify() {
  const conn = await newClient();
  try {
    const ports = { wms: 4200, xenang: 3002, thukho: 3003, kiemke: 3004 };
    const cmds = Object.entries(ports)
      .map(([name, port]) => `curl -s -o /dev/null -w '${name.padEnd(8)} HTTP %{http_code} (port ${port})\\n' http://127.0.0.1:${port}/${name}`)
      .join(' && ');
    await exec(conn, `pm2 list && echo "---" && ${cmds}`, { label: 'Verify health' });
  } finally {
    conn.end();
  }
}

async function actionFull() {
  const conn = await newClient();
  try {
    await exec(conn, `cd ${PROJECT_DIR} && git fetch origin && git checkout ${GIT_BRANCH} && git pull origin ${GIT_BRANCH}`, {
      label: 'Step 1/4: git pull',
    });
    await exec(conn, `cd ${PROJECT_DIR} && npx prisma generate`, { label: 'Step 2/4: prisma generate' });
    for (const t of INSTANCES) {
      await exec(conn, `cd ${PROJECT_DIR} && BASE_PATH=/${t} npm run build`, { label: `Step 3/4: build /${t}` });
    }
    const names = INSTANCES.map((t) => `wms-${t === 'wms' ? 'vinhgiang' : t}`).join(' ');
    await exec(conn, `pm2 restart ${names} && pm2 save`, { label: 'Step 4/4: restart PM2' });
  } finally {
    conn.end();
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

const ACTIONS = {
  test: () => actionTest(),
  exec: (args) => actionExec(args.join(' ')),
  upload: (args) => actionUpload(args[0], args[1]),
  download: (args) => actionDownload(args[0], args[1]),
  'upload-many': (args) => actionUploadMany(args),
  'sync-files': (args) => actionSyncFiles(args),
  pull: () => actionPull(),
  migrate: (args) => actionMigrate(args[0]),
  'prisma-generate': () => actionPrismaGenerate(),
  build: (args) => actionBuild(args[0] || 'all'),
  restart: (args) => actionRestart(args[0] || 'all'),
  status: () => actionStatus(),
  logs: (args) => actionLogs(args[0], args[1]),
  verify: () => actionVerify(),
  full: () => actionFull(),
};

async function main() {
  const [, , action, ...rest] = process.argv;
  if (!action || !ACTIONS[action]) {
    console.error(`Usage: node vps-deploy.js <action> [args]\n`);
    console.error('Actions:');
    console.error('  test                        Test SSH + show project info');
    console.error('  exec "<cmd>"                Run shell command');
    console.error('  upload <local> <remote>     Upload single file');
    console.error('  sync-files <f1> <f2> ...    Upload files (target auto from project root)');
    console.error('  pull                        git pull on VPS');
    console.error('  migrate <local-sql>         Upload SQL + backup + apply + prisma generate');
    console.error('  prisma-generate             npx prisma generate');
    console.error('  build <instance|all>        Build 1 instance');
    console.error('  restart <instance|all>      Restart PM2');
    console.error('  status                      PM2 list + git status');
    console.error('  logs <instance> [lines]     PM2 logs');
    console.error('  verify                      HTTP health-check');
    console.error('  full                        pull → prisma-generate → build all → restart all');
    process.exit(1);
  }
  try {
    console.log(`\n🚀 vps-deploy → ${VPS.username}@${VPS.host}:${PROJECT_DIR}`);
    console.log(`   Action: ${action} ${rest.join(' ')}\n`);
    await ACTIONS[action](rest);
    console.log(`\n✔ ${action} done.`);
  } catch (err) {
    console.error(`\n✖ ${err.message}`);
    if (err.code) console.error(`  Exit code: ${err.code}`);
    process.exit(1);
  }
}

main();
