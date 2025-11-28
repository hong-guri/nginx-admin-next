import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';

// 접속 IP 순위 조회
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const proxyHostId = searchParams.get('proxy_host_id');
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));
    const hours = parseInt(searchParams.get('hours') || '24', 10);

    // 내부 IP 필터링: 127.x.x.x, 10.x.x.x, 172.16-31.x.x, 192.168.x.x
    let sql = `
      SELECT 
        ip_address,
        COUNT(*) as access_count,
        COUNT(DISTINCT url) as unique_urls,
        COUNT(DISTINCT DATE(created_at)) as active_days,
        MAX(created_at) as last_access,
        MIN(created_at) as first_access,
        SUM(bytes_sent) as total_bytes_sent,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 ELSE 0 END) as client_error_count,
        SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as server_error_count
      FROM access_logs
      WHERE ip_address IS NOT NULL 
        AND ip_address != ''
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        AND ip_address NOT IN ('127.0.0.1', 'localhost')
        AND ip_address NOT LIKE '127.%'
        AND ip_address NOT LIKE '10.%'
        AND ip_address NOT LIKE '172.1[6-9].%'
        AND ip_address NOT LIKE '172.2[0-9].%'
        AND ip_address NOT LIKE '172.3[0-1].%'
        AND ip_address NOT LIKE '192.168.%'
        AND ip_address REGEXP '^[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}$'
    `;
    const params: any[] = [hours];

    if (proxyHostId) {
      sql += ' AND proxy_host_id = ?';
      params.push(parseInt(proxyHostId, 10));
    }

    sql += ` GROUP BY ip_address ORDER BY access_count DESC LIMIT ${limit}`;

    const ips = await query(sql, params);

    return NextResponse.json(ips);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('IP 통계 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

