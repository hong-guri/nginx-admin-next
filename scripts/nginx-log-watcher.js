#!/usr/bin/env node

/**
 * Nginx 로그 파일 모니터링 스크립트
 * NPM의 로그 파일을 실시간으로 모니터링하여 트래픽 데이터를 직접 MySQL에 저장
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const LOG_DIR = process.env.NPM_LOG_DIR || '/data/logs';
const WATCH_INTERVAL = parseInt(process.env.WATCH_INTERVAL || '1000', 10); // 1초
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100', 10); // 배치 처리 크기
const STATS_INTERVAL = parseInt(process.env.STATS_INTERVAL || '300000', 10); // 5분마다 통계 출력
const MAX_LOG_AGE_DAYS = parseInt(process.env.MAX_LOG_AGE_DAYS || '7', 10); // 7일 이상 된 로그는 무시
const MAX_CONCURRENT_FILES = parseInt(process.env.MAX_CONCURRENT_FILES || '5', 10); // 동시 처리할 최대 파일 수

// 필수 환경 변수 체크
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('[Log Watcher] 필수 환경 변수가 설정되지 않았습니다:', missingVars.join(', '));
  console.error('[Log Watcher] 환경 변수를 설정하거나 .env 파일을 확인하세요.');
  process.exit(1);
}

// MySQL 연결 설정
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 30,
  queueLimit: 0,
};

// MySQL 연결 풀 생성
let dbPool = null;

async function initDatabase() {
  try {
    dbPool = mysql.createPool(dbConfig);
    // 연결 테스트
    const connection = await dbPool.getConnection();
    await connection.ping();
    connection.release();
    console.log('[Log Watcher] MySQL 연결 성공');
    return true;
  } catch (error) {
    console.error('[Log Watcher] MySQL 연결 실패:', error.message);
    return false;
  }
}

// 이미 처리한 로그 파일과 위치 추적
const filePositions = new Map();

// 통계 추적
const stats = {
  totalLinesProcessed: 0,
  totalErrors: 0,
  lastProcessedTime: null,
  proxyHostStats: new Map(), // proxyHostId -> { count, lastAccess }
  consecutiveErrors: 0, // 연속 오류 카운트
};

/**
 * Nginx 로그 라인 파싱
 * NPM 커스텀 포맷: [27/Nov/2025:01:21:17 +0000] - 502 502 - GET https network.gatsbygreen.com "/" [Client 167.99.182.39] [Length 154] [Gzip -] [Sent-to nginx-admin-next] "-" "-"
 */
function parseNginxLogLine(line) {
  if (!line || !line.trim()) {
    return null;
  }

  try {
    // 패턴 1: NPM 커스텀 로그 포맷 (우선 처리)
    // [27/Nov/2025:01:21:17 +0000] - 502 502 - GET https network.gatsbygreen.com "/" [Client 167.99.182.39] [Length 154] [Gzip -] [Sent-to nginx-admin-next] "-" "-"
    let regex = /^\[([^\]]+)\]\s+-\s+(\d+)\s+(\d+)\s+-\s+(\S+)\s+(\S+)\s+(\S+)\s+"([^"]+)"\s+\[Client\s+([^\]]+)\]\s+\[Length\s+(\d+)\]\s+\[Gzip\s+([^\]]+)\]\s+\[Sent-to\s+([^\]]+)\]\s+"([^"]*)"\s+"([^"]*)"$/;
    let match = line.match(regex);
    
    if (match) {
      const [, timestampStr, statusCode1, statusCode2, , method, protocol, host, url, clientIp, length, , , referer, userAgent] = match;
      
      // 타임스탬프 파싱
      let logTimestamp = new Date();
      try {
        // NPM 타임스탬프 포맷: 27/Nov/2025:01:21:17 +0000
        const timestampMatch = timestampStr.match(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{4})/);
        if (timestampMatch) {
          const [, day, month, year, hour, min, sec, tz] = timestampMatch;
          const monthMap = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
          const monthNum = monthMap[month] || '01';
          logTimestamp = new Date(`${year}-${monthNum}-${day}T${hour}:${min}:${sec}${tz}`);
          if (isNaN(logTimestamp.getTime())) {
            logTimestamp = new Date();
          }
        }
      } catch (e) {
        logTimestamp = new Date();
      }
      
      return {
        ipAddress: clientIp || '0.0.0.0',
        logTimestamp,
        method: method || 'GET',
        url: url || '/',
        protocol: protocol || 'HTTP/1.1',
        statusCode: parseInt(statusCode1) || parseInt(statusCode2) || 200,
        bytesSent: parseInt(length) || 0,
        referer: referer && referer !== '-' ? referer : undefined,
        userAgent: userAgent && userAgent !== '-' ? userAgent : undefined,
      };
    }
    
    // 패턴 2: NPM 포맷 (유연한 버전 - 일부 필드가 없을 수 있음)
    regex = /^\[([^\]]+)\]\s+.*?\[Client\s+([^\]]+)\].*?\[Length\s+(\d+)\]/;
    match = line.match(regex);
    
    if (match) {
      const [, timestampStr, clientIp, length] = match;
      
      // 타임스탬프 파싱
      let logTimestamp = new Date();
      try {
        const timestampMatch = timestampStr.match(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{4})/);
        if (timestampMatch) {
          const [, day, month, year, hour, min, sec, tz] = timestampMatch;
          const monthMap = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
          const monthNum = monthMap[month] || '01';
          logTimestamp = new Date(`${year}-${monthNum}-${day}T${hour}:${min}:${sec}${tz}`);
          if (isNaN(logTimestamp.getTime())) {
            logTimestamp = new Date();
          }
        }
      } catch (e) {
        logTimestamp = new Date();
      }
      
      // 메서드와 URL 추출
      const methodMatch = line.match(/\s+(\S+)\s+(\S+)\s+(\S+)\s+"([^"]+)"/);
      const statusMatch = line.match(/\s+(\d+)\s+(\d+)\s+/);
      
      return {
        ipAddress: clientIp || '0.0.0.0',
        logTimestamp,
        method: methodMatch ? methodMatch[1] : 'GET',
        url: methodMatch ? methodMatch[4] : '/',
        protocol: methodMatch ? methodMatch[2] : 'HTTP/1.1',
        statusCode: statusMatch ? parseInt(statusMatch[1]) : 200,
        bytesSent: parseInt(length) || 0,
      };
    }
    
    // 패턴 3: 표준 Combined 로그 포맷 (fallback)
    // 예: 192.168.1.1 - - [25/Dec/2024:10:00:00 +0000] "GET /test HTTP/1.1" 200 1024 "-" "Mozilla/5.0"
    regex = /^(\S+) - (\S+) \[([^\]]+)\] "(\S+) (\S+) ([^"]+)" (\d+) (\d+) "([^"]*)" "([^"]*)"$/;
    match = line.match(regex);
    
    if (match) {
      const [, ip, , timestampStr, method, url, protocol, statusCode, bytesSent, referer, userAgent] = match;
      
      // 타임스탬프 파싱
      let logTimestamp = new Date();
      try {
        const timestampMatch = timestampStr.match(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{4})/);
        if (timestampMatch) {
          const [, day, month, year, hour, min, sec, tz] = timestampMatch;
          const monthMap = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
          const monthNum = monthMap[month] || '01';
          logTimestamp = new Date(`${year}-${monthNum}-${day}T${hour}:${min}:${sec}${tz}`);
          if (isNaN(logTimestamp.getTime())) {
            logTimestamp = new Date();
          }
        }
      } catch (e) {
        logTimestamp = new Date();
      }
      
      return {
        ipAddress: ip,
        logTimestamp,
        method: method || 'GET',
        url: url || '/',
        protocol: protocol || 'HTTP/1.1',
        statusCode: parseInt(statusCode) || 200,
        bytesSent: parseInt(bytesSent) || 0,
        referer: referer && referer !== '-' ? referer : undefined,
        userAgent: userAgent && userAgent !== '-' ? userAgent : undefined,
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 로그 파일명에서 프록시 호스트 ID 추출
 */
function extractProxyHostIdFromFilename(filename) {
  const match = filename.match(/proxy-host-(\d+)/);
  if (match) {
    return parseInt(match[1]);
  }
  return null;
}

/**
 * 배치로 트래픽 데이터를 MySQL에 저장
 */
async function saveLogLinesBatch(parsedLines, proxyHostId, retryCount = 0) {
  if (parsedLines.length === 0 || !proxyHostId) {
    return { success: 0, total: parsedLines.length };
  }

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 500; // 500ms (데드락 재시도 지연 시간 증가)
  
  // 오래된 로그 필터링 (7일 이상 된 로그는 무시)
  const maxAge = new Date();
  maxAge.setDate(maxAge.getDate() - MAX_LOG_AGE_DAYS);
  
  const filteredLines = parsedLines.filter(parsed => {
    if (!parsed.logTimestamp) return false;
    return parsed.logTimestamp >= maxAge;
  });
  
  if (filteredLines.length === 0) {
    return { success: 0, total: parsedLines.length, skipped: parsedLines.length };
  }
  
  const skippedCount = parsedLines.length - filteredLines.length;
  if (skippedCount > 0) {
    console.log(`[Log Watcher] 오래된 로그 ${skippedCount}개 건너뜀 (${MAX_LOG_AGE_DAYS}일 이상)`);
  }

  const connection = await dbPool.getConnection();
  
  try {
    await connection.beginTransaction();

    // access_logs 배치 INSERT
    const accessLogsValues = filteredLines.map(parsed => [
      proxyHostId,
      parsed.url.substring(0, 500),
      parsed.method.substring(0, 10),
      parsed.statusCode,
      parsed.ipAddress || null,
      parsed.userAgent ? parsed.userAgent.substring(0, 500) : null,
      parsed.referer ? parsed.referer.substring(0, 500) : null,
      parsed.bytesSent || 0,
      0, // response_time_ms
      parsed.logTimestamp || null,
    ]);

    if (accessLogsValues.length > 0) {
      await connection.query(
        `INSERT IGNORE INTO access_logs 
         (proxy_host_id, url, method, status_code, ip_address, user_agent, referer, bytes_sent, response_time_ms, log_timestamp)
         VALUES ?`,
        [accessLogsValues]
      );
    }

    // realtime_traffic 집계 (1분 단위)
    const minuteBuckets = new Map();
    filteredLines.forEach(parsed => {
      const minuteBucket = new Date(parsed.logTimestamp);
      minuteBucket.setSeconds(0, 0);
      const key = minuteBucket.toISOString();
      
      if (!minuteBuckets.has(key)) {
        minuteBuckets.set(key, { bucket: minuteBucket, count: 0, totalResponseTime: 0 });
      }
      const bucket = minuteBuckets.get(key);
      bucket.count++;
      bucket.totalResponseTime += 0; // response_time는 로그에 없음
    });

    for (const [key, bucket] of minuteBuckets) {
      await connection.query(
        `INSERT INTO realtime_traffic (proxy_host_id, timestamp, request_count, response_time_ms)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           request_count = request_count + ?,
           response_time_ms = (response_time_ms + ?) / 2`,
        [
          proxyHostId,
          bucket.bucket,
          bucket.count,
          0,
          bucket.count,
          0,
        ]
      );
    }

    // traffic_stats 집계 (1시간 단위)
    const hourBuckets = new Map();
    filteredLines.forEach(parsed => {
      const hourBucket = new Date(parsed.logTimestamp);
      hourBucket.setMinutes(0, 0, 0);
      const key = hourBucket.toISOString();
      
      if (!hourBuckets.has(key)) {
        hourBuckets.set(key, {
          bucket: hourBucket,
          count: 0,
          totalBytesSent: 0,
          status2xx: 0,
          status4xx: 0,
          status5xx: 0,
        });
      }
      const bucket = hourBuckets.get(key);
      bucket.count++;
      bucket.totalBytesSent += parsed.bytesSent || 0;
      if (parsed.statusCode >= 200 && parsed.statusCode < 300) bucket.status2xx++;
      if (parsed.statusCode >= 400 && parsed.statusCode < 500) bucket.status4xx++;
      if (parsed.statusCode >= 500) bucket.status5xx++;
    });

    for (const [key, bucket] of hourBuckets) {
      await connection.query(
        `INSERT INTO traffic_stats 
         (proxy_host_id, timestamp, request_count, bytes_sent, avg_response_time_ms, status_2xx, status_4xx, status_5xx)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           request_count = request_count + ?,
           bytes_sent = bytes_sent + ?,
           avg_response_time_ms = (avg_response_time_ms + ?) / 2,
           status_2xx = status_2xx + ?,
           status_4xx = status_4xx + ?,
           status_5xx = status_5xx + ?`,
        [
          proxyHostId,
          bucket.bucket,
          bucket.count,
          bucket.totalBytesSent,
          0,
          bucket.status2xx,
          bucket.status4xx,
          bucket.status5xx,
          bucket.count,
          bucket.totalBytesSent,
          0,
          bucket.status2xx,
          bucket.status4xx,
          bucket.status5xx,
        ]
      );
    }

    await connection.commit();
    
    stats.totalLinesProcessed += filteredLines.length;
    stats.lastProcessedTime = new Date();
    stats.consecutiveErrors = 0;

    const hostStats = stats.proxyHostStats.get(String(proxyHostId)) || { count: 0, lastAccess: null };
    hostStats.count += filteredLines.length;
    hostStats.lastAccess = new Date();
    stats.proxyHostStats.set(String(proxyHostId), hostStats);

    return { success: filteredLines.length, total: parsedLines.length, skipped: skippedCount };
  } catch (error) {
    await connection.rollback();
    
    // 데드락 또는 일시적 오류인 경우 재시도
    const isRetryableError = error.code === 'ER_LOCK_DEADLOCK' || 
                             error.code === 'ER_LOCK_WAIT_TIMEOUT' ||
                             error.message.includes('Deadlock') ||
                             error.message.includes('Lock wait timeout');
    
    if (isRetryableError && retryCount < MAX_RETRIES) {
      connection.release();
      // 지수 백오프로 재시도 (더 긴 지연 시간)
      const delay = RETRY_DELAY * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return saveLogLinesBatch(parsedLines, proxyHostId, retryCount + 1);
    }
    
    stats.totalErrors += filteredLines.length;
    stats.consecutiveErrors++;
    
    // 에러를 항상 출력하도록 수정 (처음 5번 또는 10번마다)
    if (stats.consecutiveErrors <= 5 || stats.consecutiveErrors % 10 === 0) {
      console.error(`[Log Watcher] DB 저장 오류 (${stats.consecutiveErrors}번 연속):`, error.message);
      if (error.stack) {
        console.error(`[Log Watcher] 스택 트레이스:`, error.stack);
      }
    }
    
    return { success: 0, total: parsedLines.length, skipped: skippedCount };
  } finally {
    connection.release();
  }
}

/**
 * 로그 파일의 새 라인 읽기 및 처리
 */
async function readNewLines(filePath) {
  const fileKey = filePath;
  let lastPosition = filePositions.get(fileKey) || 0;

  try {
    const fileStats = fs.statSync(filePath);
    const currentSize = fileStats.size;

    if (currentSize < lastPosition) {
      // 파일이 로테이션되었거나 잘렸을 경우
      console.log(`[Log Watcher] 로그 파일 로테이션 감지: ${path.basename(filePath)}`);
      lastPosition = 0;
    }

    if (currentSize > lastPosition) {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(currentSize - lastPosition);
      fs.readSync(fd, buffer, 0, buffer.length, lastPosition);
      fs.closeSync(fd);

      const newContent = buffer.toString('utf-8');
      const lines = newContent.split('\n').filter(line => line.trim());

      if (lines.length > 0) {
        const filename = path.basename(filePath);
        const proxyHostId = extractProxyHostIdFromFilename(filename);
        
        if (!proxyHostId) {
          // 프록시 호스트 ID를 찾을 수 없으면 건너뛰기 (fallback_access.log 등)
          filePositions.set(fileKey, currentSize);
          return;
        }

        console.log(`[Log Watcher] 새로운 접속 감지: ${filename} (${lines.length}개 라인)`);

        // 로그 라인 파싱
        const parsedLines = [];
        let parseFailCount = 0;
        const failedLines = [];
        for (const line of lines) {
          const parsed = parseNginxLogLine(line);
          if (parsed) {
            parsedLines.push(parsed);
          } else {
            parseFailCount++;
            // 처음 3개 실패 라인만 저장 (디버깅용)
            if (failedLines.length < 3) {
              failedLines.push(line);
            }
          }
        }

        if (parseFailCount > 0) {
          console.warn(`[Log Watcher] 파싱 실패: ${parseFailCount}개 라인 (${filename})`);
          // 실패한 라인 샘플 출력 (처음 3개만)
          if (failedLines.length > 0) {
            console.warn(`[Log Watcher] 파싱 실패 샘플 (${filename}):`);
            failedLines.forEach((line, idx) => {
              console.warn(`  [${idx + 1}] ${line.substring(0, 200)}`);
            });
          }
        }

        if (parsedLines.length === 0) {
          console.warn(`[Log Watcher] 파싱된 라인이 없습니다 (${filename})`);
          filePositions.set(fileKey, currentSize);
          return;
        }

        // 배치로 저장
        let successCount = 0;
        let errorCount = 0;
        for (let i = 0; i < parsedLines.length; i += BATCH_SIZE) {
          const batch = parsedLines.slice(i, i + BATCH_SIZE);
          try {
            const result = await saveLogLinesBatch(batch, proxyHostId);
            successCount += result.success;
            if (result.success === 0) {
              errorCount += result.total;
            }
          } catch (error) {
            console.error(`[Log Watcher] 배치 저장 오류 (${filename}):`, error.message);
            errorCount += batch.length;
          }
        }

        if (successCount > 0) {
          console.log(`[Log Watcher] ✓ ${successCount}/${parsedLines.length} 라인 처리 완료 (${filename})`);
        } else if (parsedLines.length > 0) {
          console.error(`[Log Watcher] ✗ ${filename}: 모든 라인 처리 실패 (${parsedLines.length}개, 파싱 실패: ${parseFailCount}개)`);
        }
      }

      filePositions.set(fileKey, currentSize);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`[Log Watcher] 파일 읽기 오류 (${filePath}):`, error.message);
    } else {
      // 파일이 없으면 위치 초기화
      filePositions.delete(fileKey);
    }
  }
}

/**
 * 로그 파일 찾기
 */
function findLogFiles() {
  const logFiles = [];
  
  try {
    const files = fs.readdirSync(LOG_DIR);
    files.forEach(file => {
      // access.log 파일만 처리 (error.log, .gz 파일 제외)
      if (file.includes('access.log') && !file.endsWith('.gz') && !file.includes('error.log')) {
        const fullPath = path.join(LOG_DIR, file);
        try {
          const stats = fs.statSync(fullPath);
          if (stats.isFile()) {
            logFiles.push(fullPath);
          }
        } catch (err) {
          // 파일 접근 불가 시 무시
        }
      }
    });
  } catch (err) {
    console.error('[Log Watcher] 로그 디렉토리 읽기 실패:', err.message);
  }
  
  return logFiles;
}

/**
 * 통계 출력
 */
function printStats() {
  const now = new Date();
  const uptime = stats.lastProcessedTime 
    ? Math.floor((now - stats.lastProcessedTime) / 1000)
    : 0;

  console.log('\n[Log Watcher] === 통계 ===');
  console.log(`총 처리된 라인: ${stats.totalLinesProcessed}`);
  console.log(`오류 수: ${stats.totalErrors}`);
  console.log(`마지막 처리 시간: ${stats.lastProcessedTime ? stats.lastProcessedTime.toLocaleString('ko-KR') : '없음'}`);
  
  if (stats.proxyHostStats.size > 0) {
    console.log(`\n프록시 호스트별 통계:`);
    const sortedHosts = Array.from(stats.proxyHostStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10); // 상위 10개만 표시
    
    sortedHosts.forEach(([hostId, hostStats]) => {
      console.log(`  - Host #${hostId}: ${hostStats.count}건 (마지막: ${hostStats.lastAccess.toLocaleTimeString('ko-KR')})`);
    });
  }
  console.log('========================\n');
}

/**
 * 메인 루프
 */
async function watchLogs() {
  console.log('[Log Watcher] 로그 파일 모니터링 시작...');
  console.log(`[Log Watcher] 로그 디렉토리: ${LOG_DIR}`);
  console.log(`[Log Watcher] 모니터링 간격: ${WATCH_INTERVAL}ms`);
  console.log(`[Log Watcher] 배치 처리 크기: ${BATCH_SIZE} 라인`);
  console.log(`[Log Watcher] 통계 출력 간격: ${STATS_INTERVAL / 1000 / 60}분\n`);

  // MySQL 연결 초기화
  const dbConnected = await initDatabase();
  if (!dbConnected) {
    console.error('[Log Watcher] MySQL 연결에 실패했습니다. 10초 후 재시도합니다...');
    setTimeout(() => {
      process.exit(1);
    }, 10000);
    return;
  }

  // 주기적으로 통계 출력
  setInterval(() => {
    if (stats.totalLinesProcessed > 0 || stats.totalErrors > 0) {
      printStats();
    }
  }, STATS_INTERVAL);

  setInterval(async () => {
    const logFiles = findLogFiles();
    
    if (logFiles.length === 0) {
      // 첫 실행 시에만 경고 출력
      if (stats.totalLinesProcessed === 0 && stats.totalErrors === 0) {
        console.warn('[Log Watcher] 로그 파일을 찾을 수 없습니다.');
      }
      return;
    }

    // 동시 처리 개수 제한 (데드락 방지)
    const chunks = [];
    for (let i = 0; i < logFiles.length; i += MAX_CONCURRENT_FILES) {
      chunks.push(logFiles.slice(i, i + MAX_CONCURRENT_FILES));
    }
    
    for (const chunk of chunks) {
      await Promise.all(chunk.map(filePath => readNewLines(filePath)));
    }
  }, WATCH_INTERVAL);
}

// 시작
watchLogs();

// 에러 핸들링
process.on('uncaughtException', (error) => {
  console.error('[Log Watcher] 예상치 못한 오류:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Log Watcher] 처리되지 않은 Promise 거부:', reason);
});

// 종료 시 연결 정리
process.on('SIGTERM', async () => {
  console.log('[Log Watcher] 종료 중...');
  if (dbPool) {
    await dbPool.end();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Log Watcher] 종료 중...');
  if (dbPool) {
    await dbPool.end();
  }
  process.exit(0);
});

