#!/usr/bin/env node

/**
 * 통합 서버
 * - Nginx 로그 모니터링
 * - 프록시 호스트 상태 확인 (크론)
 */

const { spawn } = require('child_process');
const path = require('path');

const LOG_WATCHER_SCRIPT = path.join(__dirname, '../scripts/nginx-log-watcher.js');
const STATUS_CHECKER_SCRIPT = path.join(__dirname, '../scripts/check-proxy-status.js');

// 로그 와처 실행
console.log('[Server] 로그 와처 시작...');
const logWatcher = spawn('node', [LOG_WATCHER_SCRIPT], {
  stdio: 'inherit',
  env: process.env,
});

logWatcher.on('error', (error) => {
  console.error('[Server] 로그 와처 오류:', error);
});

logWatcher.on('exit', (code) => {
  console.error(`[Server] 로그 와처 종료 (코드: ${code})`);
  process.exit(code);
});

// 상태 확인 크론 (매일 새벽 2시)
function scheduleStatusCheck() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(2, 0, 0, 0);
  
  const msUntilNext = tomorrow.getTime() - now.getTime();
  
  console.log(`[Server] 다음 상태 확인 예약: ${tomorrow.toLocaleString()} (${Math.round(msUntilNext / 1000 / 60)}분 후)`);
  
  setTimeout(() => {
    runStatusCheck();
    // 매일 반복
    setInterval(runStatusCheck, 24 * 60 * 60 * 1000);
  }, msUntilNext);
}

// 서버 켜질때 상태 확인 실행
function runStatusCheck() {
  console.log('[Server] 프록시 호스트 상태 확인 시작...');
  const statusChecker = spawn('node', [STATUS_CHECKER_SCRIPT], {
    stdio: 'inherit',
    env: process.env,
  });
  

  statusChecker.on('error', (error) => {
    console.error('[Server] 상태 확인 오류:', error);
  });

  statusChecker.on('exit', (code) => {
    if (code === 0) {
      console.log('[Server] 상태 확인 완료');
    } else {
      console.error(`[Server] 상태 확인 실패 (코드: ${code})`);
    }
  });
}

// 서버 시작 시 즉시 상태 확인 실행
console.log('[Server] 서버 시작 시 상태 확인 실행...');
runStatusCheck();

// 상태 확인 크론 시작 (매일 새벽 2시)
scheduleStatusCheck();

// 프로세스 종료 처리
process.on('SIGTERM', () => {
  console.log('[Server] 종료 신호 수신, 로그 와처 종료 중...');
  logWatcher.kill();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] 종료 신호 수신, 로그 와처 종료 중...');
  logWatcher.kill();
  process.exit(0);
});

