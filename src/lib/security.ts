import { query, queryOne, execute } from './db';

export interface SecurityCheckResult {
  blocked: boolean;
  reason?: string;
  eventType?: 'BLOCKED_IP' | 'BLOCKED_PATH' | 'SUSPICIOUS_UA' | 'RATE_LIMIT' | 'VULNERABILITY_DETECTED' | 'SQL_INJECTION' | 'XSS' | 'PATH_TRAVERSAL' | 'COMMAND_INJECTION' | 'ANOMALY_DETECTED';
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// 고급 보안 탐지 패턴
const SECURITY_PATTERNS = {
  sqlInjection: [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i,
    /exec(\s|\+)+(s|x)p\w+/i,
    /union[^a-z]+select/i,
    /select.*from/i,
    /insert.*into/i,
    /delete.*from/i,
    /update.*set/i,
    /drop.*table/i,
  ],
  xss: [
    /((\%3C)|<)((\%2F)|\/)*[a-z0-9\%]+((\%3E)|>)/i,
    /((\%3C)|<)[^\n]+((\%3E)|>)/i,
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/i,
    /on\w+\s*=/i,
    /<img[^>]+src[^>]*=.*javascript:/i,
    /<body[^>]*onload/i,
    /<svg[^>]*onload/i,
  ],
  pathTraversal: [
    /\.\.\//g,
    /\.\.\\/g,
    /\.\.%2f/i,
    /\.\.%5c/i,
    /\.\.%252f/i,
    /\.\.%255c/i,
    /\.\.%c0%af/i,
    /\.\.%c1%9c/i,
  ],
  commandInjection: [
    /;.*(rm|ls|cat|echo|wget|curl|nc|netcat|bash|sh|python|perl|ruby)\s/i,
    /\|.*(rm|ls|cat|echo|wget|curl|nc|netcat|bash|sh|python|perl|ruby)\s/i,
    /`.*(rm|ls|cat|echo|wget|curl|nc|netcat|bash|sh|python|perl|ruby)\s/i,
    /\$\(.*(rm|ls|cat|echo|wget|curl|nc|netcat|bash|sh|python|perl|ruby)\s/i,
    /&&.*(rm|ls|cat|echo|wget|curl|nc|netcat|bash|sh|python|perl|ruby)\s/i,
    /\|\|.*(rm|ls|cat|echo|wget|curl|nc|netcat|bash|sh|python|perl|ruby)\s/i,
  ],
  suspiciousUA: [
    /scanner|crawler|spider|scraper|nikto|sqlmap|nmap|masscan|burp|zap|dirbuster|gobuster|wfuzz|ffuf/i,
    /python-requests|curl\/|wget|libwww-perl|Go-http-client/i,
  ],
};

export async function checkIPBlacklist(ip: string): Promise<boolean> {
  const result = await queryOne<{ id: number }>(
    `SELECT id FROM ip_blacklist 
     WHERE ip_address = ? 
     AND is_active = TRUE 
     AND (expires_at IS NULL OR expires_at > NOW())`,
    [ip]
  );
  return result !== null;
}

export async function checkIPWhitelist(ip: string): Promise<boolean> {
  const result = await queryOne<{ id: number }>(
    `SELECT id FROM ip_whitelist 
     WHERE ip_address = ? 
     AND is_active = TRUE`,
    [ip]
  );
  return result !== null;
}

export async function checkPathBlacklist(
  proxyHostId: number | null,
  path: string
): Promise<{ blocked: boolean; pattern?: string }> {
  // 전역 경로 블랙리스트 체크
  const globalPattern = await queryOne<{ pattern: string }>(
    `SELECT pattern FROM global_path_blacklist 
     WHERE is_active = TRUE 
     AND ? LIKE CONCAT('%', pattern, '%')`,
    [path]
  );

  if (globalPattern) {
    return { blocked: true, pattern: globalPattern.pattern };
  }

  // 프록시 호스트별 경로 블랙리스트 체크
  if (proxyHostId) {
    const hostPattern = await queryOne<{ pattern: string }>(
      `SELECT pattern FROM path_blacklist 
       WHERE proxy_host_id = ? 
       AND is_active = TRUE 
       AND ? LIKE CONCAT('%', pattern, '%')`,
      [proxyHostId, path]
    );

    if (hostPattern) {
      return { blocked: true, pattern: hostPattern.pattern };
    }
  }

  return { blocked: false };
}

export async function checkVulnerabilityPattern(path: string): Promise<{ detected: boolean; pattern?: string; severity?: string }> {
  const result = await queryOne<{ pattern: string; severity: string }>(
    `SELECT pattern, severity FROM vulnerability_patterns 
     WHERE is_active = TRUE 
     AND ? LIKE CONCAT('%', pattern, '%')`,
    [path]
  );

  if (result) {
    return { detected: true, pattern: result.pattern, severity: result.severity };
  }

  return { detected: false };
}

export async function logSecurityEvent(
  proxyHostId: number | null,
  eventType: 'BLOCKED_IP' | 'BLOCKED_PATH' | 'SUSPICIOUS_UA' | 'RATE_LIMIT' | 'VULNERABILITY_DETECTED' | 'ANOMALY_DETECTED',
  ip: string | null,
  path: string | null,
  userAgent: string | null,
  details: any = null
): Promise<void> {
  await query(
    `INSERT INTO security_events 
     (proxy_host_id, event_type, ip_address, path, user_agent, details) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      proxyHostId,
      eventType,
      ip,
      path,
      userAgent,
      details ? JSON.stringify(details) : null,
    ]
  );
}

/**
 * 고급 보안 패턴 탐지
 */
export function detectSecurityThreats(
  url: string,
  userAgent?: string | null,
  method?: string
): { detected: boolean; threatType?: string; severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; pattern?: string } {
  const fullUrl = url.toLowerCase();
  const ua = (userAgent || '').toLowerCase();
  const httpMethod = (method || 'GET').toUpperCase();

  // SQL Injection 탐지
  for (const pattern of SECURITY_PATTERNS.sqlInjection) {
    if (pattern.test(fullUrl) || pattern.test(ua)) {
      return { detected: true, threatType: 'SQL_INJECTION', severity: 'CRITICAL', pattern: pattern.toString() };
    }
  }

  // XSS 탐지
  for (const pattern of SECURITY_PATTERNS.xss) {
    if (pattern.test(fullUrl) || pattern.test(ua)) {
      return { detected: true, threatType: 'XSS', severity: 'HIGH', pattern: pattern.toString() };
    }
  }

  // Path Traversal 탐지
  for (const pattern of SECURITY_PATTERNS.pathTraversal) {
    if (pattern.test(fullUrl)) {
      return { detected: true, threatType: 'PATH_TRAVERSAL', severity: 'HIGH', pattern: pattern.toString() };
    }
  }

  // Command Injection 탐지
  for (const pattern of SECURITY_PATTERNS.commandInjection) {
    if (pattern.test(fullUrl) || pattern.test(ua)) {
      return { detected: true, threatType: 'COMMAND_INJECTION', severity: 'CRITICAL', pattern: pattern.toString() };
    }
  }

  // 의심스러운 User-Agent 탐지
  for (const pattern of SECURITY_PATTERNS.suspiciousUA) {
    if (pattern.test(ua)) {
      return { detected: true, threatType: 'SUSPICIOUS_UA', severity: 'MEDIUM', pattern: pattern.toString() };
    }
  }

  return { detected: false };
}

/**
 * Rate Limiting 위반 탐지
 */
export async function checkRateLimit(
  ip: string,
  maxRequests: number = 100,
  windowMinutes: number = 1
): Promise<{ exceeded: boolean; count: number }> {
  const result = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count 
     FROM access_logs 
     WHERE ip_address = ? 
     AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [ip, windowMinutes]
  );

  const count = result?.count || 0;
  return { exceeded: count >= maxRequests, count };
}

/**
 * 이상 탐지 (Anomaly Detection)
 * - 비정상적으로 높은 요청 수
 * - 비정상적인 응답 시간
 * - 비정상적인 에러율
 */
export async function detectAnomalies(
  ip: string,
  hours: number = 1
): Promise<{ detected: boolean; anomalies: string[] }> {
  const anomalies: string[] = [];

  // 최근 1시간 통계
  const stats = await queryOne<{
    total_requests: number;
    avg_response_time: number;
    error_rate: number;
    unique_urls: number;
  }>(
    `SELECT 
      COUNT(*) as total_requests,
      AVG(response_time_ms) as avg_response_time,
      SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) / COUNT(*) * 100 as error_rate,
      COUNT(DISTINCT url) as unique_urls
     FROM access_logs
     WHERE ip_address = ?
     AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
    [ip, hours]
  );

  if (!stats) {
    return { detected: false, anomalies: [] };
  }

  // 평균 대비 3배 이상 요청 수
  const avgRequests = await queryOne<{ avg_requests: number }>(
    `SELECT AVG(request_count) as avg_requests
     FROM (
       SELECT COUNT(*) as request_count
       FROM access_logs
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       GROUP BY ip_address
     ) as ip_stats`,
    [hours]
  );

  if (avgRequests && stats.total_requests > (avgRequests.avg_requests || 0) * 3) {
    anomalies.push(`비정상적으로 높은 요청 수: ${stats.total_requests}건`);
  }

  // 응답 시간이 5초 이상
  if (stats.avg_response_time > 5000) {
    anomalies.push(`비정상적으로 높은 응답 시간: ${stats.avg_response_time.toFixed(0)}ms`);
  }

  // 에러율이 50% 이상
  if (stats.error_rate > 50) {
    anomalies.push(`비정상적으로 높은 에러율: ${stats.error_rate.toFixed(1)}%`);
  }

  // 짧은 시간에 많은 고유 URL 접근
  if (stats.unique_urls > 100 && stats.total_requests < 200) {
    anomalies.push(`의심스러운 URL 탐색 패턴: ${stats.unique_urls}개 고유 URL`);
  }

  return { detected: anomalies.length > 0, anomalies };
}

/**
 * 자동 블랙리스트 추가 (반복 공격 시)
 */
export async function autoBlockIP(
  ip: string,
  reason: string,
  eventCount: number = 5,
  hours: number = 1
): Promise<boolean> {
  // 최근 시간 내 동일한 이벤트 타입 발생 횟수 확인
  const eventCounts = await query<{ event_type: string; count: number }[]>(
    `SELECT event_type, COUNT(*) as count
     FROM security_events
     WHERE ip_address = ?
     AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     GROUP BY event_type
     HAVING count >= ?`,
    [ip, hours, eventCount]
  );

  if (eventCounts.length > 0) {
    // 이미 블랙리스트에 있는지 확인
    const existing = await queryOne<{ id: number }>(
      `SELECT id FROM ip_blacklist WHERE ip_address = ? AND is_active = TRUE`,
      [ip]
    );

    if (!existing) {
      // 자동 블랙리스트 추가 (24시간)
      await execute(
        `INSERT INTO ip_blacklist (ip_address, reason, expires_at, is_active)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR), TRUE)
         ON DUPLICATE KEY UPDATE 
           reason = VALUES(reason),
           expires_at = VALUES(expires_at),
           is_active = TRUE`,
        [ip, `자동 차단: ${reason} (${eventCounts[0].count}회 발생)`]
      );

      // 보안 이벤트 로깅
      await logSecurityEvent(null, 'BLOCKED_IP', ip, null, null, {
        autoBlocked: true,
        reason: reason,
        eventCount: eventCounts[0].count,
      });

      return true;
    }
  }

  return false;
}

export async function generateNginxSecurityConfig(
  proxyHostId: number
): Promise<string> {
  const [ipBlacklist, pathBlacklist, globalPathBlacklist] = await Promise.all([
    query<{ ip_address: string }[]>(
      `SELECT ip_address FROM ip_blacklist 
       WHERE is_active = TRUE 
       AND (expires_at IS NULL OR expires_at > NOW())`
    ),
    query<{ path_pattern: string }[]>(
      `SELECT path_pattern FROM path_blacklist 
       WHERE proxy_host_id = ? AND is_active = TRUE`,
      [proxyHostId]
    ),
    query<{ path_pattern: string }[]>(
      `SELECT path_pattern FROM global_path_blacklist 
       WHERE is_active = TRUE`
    ),
  ]);

  let config = '';

  // IP 블랙리스트
  if (ipBlacklist.length > 0) {
    config += '# IP 블랙리스트\n';
    ipBlacklist.forEach((item) => {
      config += `deny ${item.ip_address};\n`;
    });
    config += '\n';
  }

  // 경로 블랙리스트
  const allPathPatterns = [
    ...pathBlacklist.map((p) => p.path_pattern),
    ...globalPathBlacklist.map((p) => p.path_pattern),
  ];

  if (allPathPatterns.length > 0) {
    config += '# 경로 블랙리스트\n';
    allPathPatterns.forEach((pattern) => {
      config += `location ~ ${pattern.replace(/\//g, '\\/')} {\n`;
      config += '  deny all;\n';
      config += '  return 403;\n';
      config += '}\n\n';
    });
  }

  return config;
}

