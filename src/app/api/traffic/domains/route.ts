import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';

// 도메인별 접속 순위 조회
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));
    const hours = parseInt(searchParams.get('hours') || '24', 10);

    // proxy_host_id로 그룹화 (proxy_hosts 테이블이 없으므로)
    // 내부 IP 필터링: 127.x.x.x, 10.x.x.x, 172.16-31.x.x, 192.168.x.x
    let sql = `
      SELECT 
        al.proxy_host_id,
        CONCAT('proxy-host-', al.proxy_host_id) as primary_domain,
        COUNT(*) as total_requests,
        COUNT(DISTINCT al.ip_address) as unique_ips,
        COUNT(DISTINCT al.url) as unique_urls,
        SUM(al.bytes_sent) as total_bytes_sent,
        AVG(al.response_time_ms) as avg_response_time,
        SUM(CASE WHEN al.status_code >= 200 AND al.status_code < 300 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN al.status_code >= 400 AND al.status_code < 500 THEN 1 ELSE 0 END) as client_error_count,
        SUM(CASE WHEN al.status_code >= 500 THEN 1 ELSE 0 END) as server_error_count,
        MAX(al.created_at) as last_access,
        MIN(al.created_at) as first_access
      FROM access_logs al
      WHERE al.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        AND al.ip_address NOT IN ('127.0.0.1', 'localhost')
        AND al.ip_address NOT LIKE '127.%'
        AND al.ip_address NOT LIKE '10.%'
        AND al.ip_address NOT LIKE '172.1[6-9].%'
        AND al.ip_address NOT LIKE '172.2[0-9].%'
        AND al.ip_address NOT LIKE '172.3[0-1].%'
        AND al.ip_address NOT LIKE '192.168.%'
        AND al.ip_address REGEXP '^[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}$'
    `;
    const params: any[] = [hours];

    sql += ` GROUP BY al.proxy_host_id ORDER BY total_requests DESC LIMIT ${limit}`;

    const domains = await query(sql, params);

    // primary_domain을 proxy_host_id 기반으로 설정
    const parsedDomains = domains.map((domain: any) => ({
      ...domain,
      domain_names: [domain.primary_domain],
    }));

    return NextResponse.json(parsedDomains);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('도메인 통계 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

