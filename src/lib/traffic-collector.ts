import { execute, query } from '@/lib/db';
import { NPMClient } from './npm-client';

/**
 * NPM의 프록시 호스트 목록을 가져와서 도메인 매핑 생성
 */
export async function getProxyHostDomainMap(): Promise<Map<string, number>> {
  try {
    // NPM API를 통해 프록시 호스트 목록 가져오기
    // 실제로는 세션 토큰이 필요하지만, 여기서는 환경 변수나 별도 인증 사용
    const npmClient = new NPMClient();
    const hosts = await npmClient.getProxyHosts();
    
    const domainMap = new Map<string, number>();
    hosts.forEach((host: any) => {
      if (host.domain_names && Array.isArray(host.domain_names)) {
        host.domain_names.forEach((domain: string) => {
          domainMap.set(domain.toLowerCase(), host.id);
        });
      }
    });
    
    return domainMap;
  } catch (error) {
    console.error('[Traffic Collector] 프록시 호스트 목록 조회 실패:', error);
    return new Map();
  }
}

/**
 * 요청 정보를 기반으로 프록시 호스트 ID 찾기
 */
export async function findProxyHostIdByDomain(host: string): Promise<number | null> {
  const domainMap = await getProxyHostDomainMap();
  return domainMap.get(host.toLowerCase()) || null;
}

/**
 * 트래픽 데이터 수집 (비동기, 에러가 발생해도 요청 처리에는 영향 없음)
 */
export async function collectTrafficData(data: {
  proxyHostId: number | null;
  url: string;
  method: string;
  statusCode: number;
  responseTime: number;
  bytesSent: number;
  ipAddress?: string;
  userAgent?: string;
  referer?: string;
  logTimestamp?: Date | string | null; // 로그의 원본 타임스탬프 (중복 방지용)
}) {
  try {
    if (!data.proxyHostId) {
      return; // 프록시 호스트 ID가 없으면 수집하지 않음
    }

    // 로그 타임스탬프 파싱
    let logTimestamp: Date | null = null;
    if (data.logTimestamp) {
      if (typeof data.logTimestamp === 'string') {
        logTimestamp = new Date(data.logTimestamp);
      } else {
        logTimestamp = data.logTimestamp;
      }
    }

    // access_logs 테이블에 상세 로그 저장
    // UNIQUE 제약으로 중복 자동 방지 (proxy_host_id, log_timestamp, url, ip_address, method)
    await execute(
      `INSERT INTO access_logs 
       (proxy_host_id, url, method, status_code, ip_address, user_agent, referer, bytes_sent, response_time_ms, log_timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id=id`,
      [
        data.proxyHostId,
        data.url.substring(0, 500),
        data.method.substring(0, 10),
        data.statusCode,
        data.ipAddress || null,
        data.userAgent ? data.userAgent.substring(0, 500) : null,
        data.referer ? data.referer.substring(0, 500) : null,
        data.bytesSent || 0,
        data.responseTime || 0,
        logTimestamp,
      ]
    );

    // realtime_traffic 테이블에 실시간 데이터 집계 (1분 단위)
    const minuteBucket = new Date();
    minuteBucket.setSeconds(0, 0);

    await execute(
      `INSERT INTO realtime_traffic (proxy_host_id, timestamp, request_count, response_time_ms)
       VALUES (?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE 
         request_count = request_count + 1,
         response_time_ms = (response_time_ms + ?) / 2`,
      [data.proxyHostId, minuteBucket, data.responseTime || 0, data.responseTime || 0]
    );

    // traffic_stats 테이블에 시간별 집계 (1시간 단위)
    const hourBucket = new Date();
    hourBucket.setMinutes(0, 0, 0);

    await execute(
      `INSERT INTO traffic_stats 
       (proxy_host_id, timestamp, request_count, bytes_sent, avg_response_time_ms, status_2xx, status_4xx, status_5xx)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         request_count = request_count + 1,
         bytes_sent = bytes_sent + ?,
         avg_response_time_ms = (avg_response_time_ms + ?) / 2,
         status_2xx = status_2xx + ?,
         status_4xx = status_4xx + ?,
         status_5xx = status_5xx + ?`,
      [
        data.proxyHostId,
        hourBucket,
        data.bytesSent || 0,
        data.responseTime || 0,
        data.statusCode >= 200 && data.statusCode < 300 ? 1 : 0,
        data.statusCode >= 400 && data.statusCode < 500 ? 1 : 0,
        data.statusCode >= 500 ? 1 : 0,
        data.bytesSent || 0,
        data.responseTime || 0,
        data.statusCode >= 200 && data.statusCode < 300 ? 1 : 0,
        data.statusCode >= 400 && data.statusCode < 500 ? 1 : 0,
        data.statusCode >= 500 ? 1 : 0,
      ]
    );
  } catch (error) {
    // 에러가 발생해도 요청 처리에는 영향 없도록 조용히 로깅
    console.error('[Traffic Collector] 데이터 수집 오류:', error);
  }
}

