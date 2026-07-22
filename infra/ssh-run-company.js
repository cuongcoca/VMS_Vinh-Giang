#!/usr/bin/env node
/**
 * SSH command runner cho VPS Công ty — 42.96.16.197 (khohangvinhgiang.io.vn)
 * Dùng ssh2 library với password auth
 *
 * Usage:
 *   node ssh-run-company.js "<command>"
 *   node ssh-run-company.js --upload <localPath> <remotePath>
 *
 * Env: COMPANY_VPS_PASSWORD (bắt buộc)
 */
const { Client } = require(process.env.SSH2_PATH || 'ssh2');
const fs = require('fs');

const HOST = '42.96.16.197';
const USER = 'root';
const PASSWORD = process.env.COMPANY_VPS_PASSWORD;

if (!PASSWORD) {
  console.error('ERROR: COMPANY_VPS_PASSWORD env var not set.');
  console.error('Set it:');
  console.error('  PowerShell: $env:COMPANY_VPS_PASSWORD = "your_password"');
  console.error('  CMD:        set COMPANY_VPS_PASSWORD=your_password');
  process.exit(1);
}

const args = process.argv.slice(2);
const connOpts = {
  host: HOST,
  port: 22,
  username: USER,
  password: PASSWORD,
  readyTimeout: 30000,
};

if (args[0] === '--upload') {
  const local = args[1];
  const remote = args[2];
  if (!local || !remote) {
    console.error('Usage: node ssh-run-company.js --upload <localPath> <remotePath>');
    process.exit(1);
  }
  const conn = new Client();
  conn
    .on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) {
          console.error('SFTP error:', err.message);
          process.exit(1);
        }
        sftp.fastPut(local, remote, (err2) => {
          if (err2) {
            console.error('Upload failed:', err2.message);
            process.exit(1);
          }
          console.log(`Uploaded ${local} -> ${remote}`);
          conn.end();
        });
      });
    })
    .on('error', (err) => {
      console.error('Connection error:', err.message);
      process.exit(1);
    })
    .connect(connOpts);
} else {
  const cmd = args.join(' ');
  if (!cmd) {
    console.error('Usage: node ssh-run-company.js "<command>"');
    process.exit(1);
  }
  const conn = new Client();
  let exitCode = 0;
  conn
    .on('ready', () => {
      conn.exec(cmd, { pty: false }, (err, stream) => {
        if (err) {
          console.error('Exec error:', err.message);
          conn.end();
          process.exit(1);
        }
        stream
          .on('close', (code) => {
            exitCode = code || 0;
            conn.end();
          })
          .on('data', (data) => process.stdout.write(data))
          .stderr.on('data', (data) => process.stderr.write(data));
      });
    })
    .on('close', () => process.exit(exitCode))
    .on('error', (err) => {
      console.error('Connection error:', err.message);
      process.exit(1);
    })
    .connect(connOpts);
}
