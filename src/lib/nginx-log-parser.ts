import { collectTrafficData, findProxyHostIdByDomain } from './traffic-collector';
import { detectSecurityThreats, checkRateLimit, detectAnomalies, autoBlockIP, logSecurityEvent } from './security';

/**
 * Nginx 로그 라인 파싱
 * Nginx 표준 로그 포맷: $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"
 */
export interface ParsedLogLine {
  ipAddress: string;
  timestamp: string;
  method: string;
  url: string;
  protocol: string;
  statusCode: number;
  bytesSent: number;
  referer?: string;
  userAgent?: string;
  host?: string;
}

/**
 * Nginx 로그 라인 파싱
 */
export function parseNginxLogLine(line: string): ParsedLogLine | null {
  try {
    // Nginx 표준 로그 포맷 파싱
    // 예: 192.168.1.1 - - [25/Dec/2024:10:00:00 +0000] "GET /test HTTP/1.1" 200 1024 "-" "Mozilla/5.0"
    const regex = /^(\S+) - (\S+) \[([^\]]+)\] "(\S+) (\S+) ([^"]+)" (\d+) (\d+) "([^"]*)" "([^"]*)"$/;
    const match = line.match(regex);
    
    if (!match) {
      // 다른 포맷 시도 (간단한 버전)
      const simpleRegex = /^(\S+) .*? "(\S+) (\S+) ([^"]+)" (\d+) (\d+)/;
      const simpleMatch = line.match(simpleRegex);
      
      if (!simpleMatch) {
        return null;
      }
      
      const [, ip, method, url, , statusCode, bytesSent] = simpleMatch;
      return {
        ipAddress: ip,
        timestamp: new Date().toISOString(),
        method: method || 'GET',
        url: url || '/',
        protocol: 'HTTP/1.1',
        statusCode: parseInt(statusCode) || 200,
        bytesSent: parseInt(bytesSent) || 0,
      };
    }
    
    const [, ip, , timestamp, method, url, protocol, statusCode, bytesSent, referer, userAgent] = match;
    
    return {
      ipAddress: ip,
      timestamp,
      method: method || 'GET',
      url: url || '/',
      protocol: protocol || 'HTTP/1.1',
      statusCode: parseInt(statusCode) || 200,
      bytesSent: parseInt(bytesSent) || 0,
      referer: referer && referer !== '-' ? referer : undefined,
      userAgent: userAgent && userAgent !== '-' ? userAgent : undefined,
    };
  } catch (error) {
    console.error('[Log Parser] 파싱 오류:', error, line);
    return null;
  }
}

/**
 * 로그 파일명에서 프록시 호스트 ID 추출
 * NPM은 보통 proxy-host-{id}_access.log 형식 사용
 */
export function extractProxyHostIdFromFilename(filename: string): number | null {
  const match = filename.match(/proxy-host-(\d+)/);
  if (match) {
    return parseInt(match[1]);
  }
  return null;
}

/**
 * 로그 라인을 처리하여 트래픽 데이터 수집
 */
export async function processLogLine(
  logLine: string,
  proxyHostId?: number | null,
  host?: string
): Promise<void> {
  const parsed = parseNginxLogLine(logLine);
  if (!parsed) {
    return;
  }

  // 프록시 호스트 ID 찾기
  let hostId = proxyHostId;
  if (!hostId && host) {
    hostId = await findProxyHostIdByDomain(host);
  }

  if (!hostId) {
    // 프록시 호스트를 찾을 수 없으면 수집하지 않음
    return;
  }

  // 로그 타임스탬프 파싱
  let logTimestamp: Date | null = null;
  if (parsed.timestamp) {
    try {
      // Nginx 로그 포맷: [25/Dec/2024:10:00:00 +0000]
      const timestampStr = parsed.timestamp.replace(/\[|\]/g, '');
      logTimestamp = new Date(timestampStr);
      if (isNaN(logTimestamp.getTime())) {
        logTimestamp = null;
      }
    } catch (e) {
      logTimestamp = null;
    }
  }

  // 보안 탐지 수행
  const securityThreat = detectSecurityThreats(parsed.url, parsed.userAgent, parsed.method);
  
  if (securityThreat.detected) {
    // 보안 이벤트 로깅
    await logSecurityEvent(
      hostId,
      securityThreat.threatType as any,
      parsed.ipAddress,
      parsed.url,
      parsed.userAgent ?? null,
      {
        severity: securityThreat.severity,
        pattern: securityThreat.pattern,
        method: parsed.method,
      }
    ).catch(() => {}); // 에러 무시

    // 자동 블랙리스트 추가 (CRITICAL 또는 HIGH 위협)
    if (securityThreat.severity === 'CRITICAL' || securityThreat.severity === 'HIGH') {
      await autoBlockIP(
        parsed.ipAddress,
        `${securityThreat.threatType} 탐지`,
        3, // 3회 이상 발생 시 자동 차단
        1  // 1시간 내
      ).catch(() => {}); // 에러 무시
    }
  }

  // Rate Limiting 체크
  const rateLimit = await checkRateLimit(parsed.ipAddress, 100, 1).catch(() => ({ exceeded: false, count: 0 }));
  if (rateLimit.exceeded) {
    await logSecurityEvent(
      hostId,
      'RATE_LIMIT',
      parsed.ipAddress,
      parsed.url,
      parsed.userAgent ?? null,
      { requestCount: rateLimit.count }
    ).catch(() => {}); // 에러 무시

    // Rate Limit 위반 시 자동 블랙리스트
    await autoBlockIP(
      parsed.ipAddress,
      'Rate Limit 위반',
      2, // 2회 이상 발생 시 자동 차단
      1  // 1시간 내
    ).catch(() => {}); // 에러 무시
  }

  // 이상 탐지 (주기적으로만 수행, 성능 고려)
  if (Math.random() < 0.1) { // 10% 확률로만 수행
    const anomalies = await detectAnomalies(parsed.ipAddress, 1).catch(() => ({ detected: false, anomalies: [] }));
    if (anomalies.detected) {
      await logSecurityEvent(
        hostId,
        'ANOMALY_DETECTED',
        parsed.ipAddress,
        parsed.url,
        parsed.userAgent ?? null,
        { anomalies: anomalies.anomalies }
      ).catch(() => {}); // 에러 무시
    }
  }

  // 트래픽 데이터 수집 (비동기, 에러 무시)
  await collectTrafficData({
    proxyHostId: hostId,
    url: parsed.url,
    method: parsed.method,
    statusCode: parsed.statusCode,
    responseTime: 0, // 로그에 없으면 0
    bytesSent: parsed.bytesSent,
    ipAddress: parsed.ipAddress,
    userAgent: parsed.userAgent,
    referer: parsed.referer,
    logTimestamp: logTimestamp, // 로그의 원본 타임스탬프 전달 (중복 방지용)
  });
}

