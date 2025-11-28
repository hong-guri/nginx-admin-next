import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';

// 전체 트래픽 요약 통계
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const proxyHostId = searchParams.get('proxy_host_id');
    const hours = parseInt(searchParams.get('hours') || '24', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10); // 이전 기간 비교용

    // 내부 IP 필터링 추가
    let whereClause: string;
    const params: any[] = [];
    
    if (offset === 0) {
      // 현재 기간
      whereClause = `WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
          AND ip_address NOT IN ('127.0.0.1', 'localhost')
          AND ip_address NOT LIKE '127.%'
          AND ip_address NOT LIKE '10.%'
          AND ip_address NOT LIKE '172.1[6-9].%'
          AND ip_address NOT LIKE '172.2[0-9].%'
          AND ip_address NOT LIKE '172.3[0-1].%'
          AND ip_address NOT LIKE '192.168.%'
          AND ip_address REGEXP '^[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}$'`;
      params.push(hours);
    } else {
      // 이전 기간 (offset 시간 전부터 hours 시간 전까지)
      whereClause = `WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
          AND created_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
          AND ip_address NOT IN ('127.0.0.1', 'localhost')
          AND ip_address NOT LIKE '127.%'
          AND ip_address NOT LIKE '10.%'
          AND ip_address NOT LIKE '172.1[6-9].%'
          AND ip_address NOT LIKE '172.2[0-9].%'
          AND ip_address NOT LIKE '172.3[0-1].%'
          AND ip_address NOT LIKE '192.168.%'
          AND ip_address REGEXP '^[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}$'`;
      params.push(hours + offset, offset);
    }

    if (proxyHostId) {
      whereClause += ' AND proxy_host_id = ?';
      params.push(parseInt(proxyHostId, 10));
    }

    const sql = `
      SELECT 
        COUNT(*) as total_requests,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(DISTINCT url) as unique_urls,
        COUNT(DISTINCT proxy_host_id) as active_proxy_hosts,
        SUM(bytes_sent) as total_bytes_sent,
        AVG(bytes_sent) as avg_bytes_sent,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as status_2xx,
        SUM(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 ELSE 0 END) as status_4xx,
        SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as status_5xx,
        MIN(created_at) as first_request,
        MAX(created_at) as last_request
      FROM access_logs
      ${whereClause}
    `;

    const [summary] = await query(sql, params);

    // 피크 RPS 및 피크 시간 계산 (현재 기간만)
    let peakRps = 0;
    let peakHour = '';
    if (offset === 0) {
      const peakRpsSql = `
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m-%d %H:00') as hour,
          COUNT(*) / 3600.0 as rps
        FROM access_logs
        ${whereClause}
        ${proxyHostId ? ' AND proxy_host_id = ?' : ''}
        GROUP BY hour
        ORDER BY rps DESC
        LIMIT 1
      `;
      const peakRpsParams = [...params, ...(proxyHostId ? [parseInt(proxyHostId, 10)] : [])];
      const peakRpsResult = await query(peakRpsSql, peakRpsParams);
      peakRps = peakRpsResult[0]?.rps || 0;
      peakHour = peakRpsResult[0]?.hour || '';
    }

    // 시간대별 통계 - 시간 범위에 따라 적절한 단위로 그룹화
    const hourlyWhereClause = whereClause + (proxyHostId ? ' AND proxy_host_id = ?' : '');
    
    let hourly;
    const hourlyParams = [...params, ...(proxyHostId ? [parseInt(proxyHostId, 10)] : [])];
    
    // 1시간 이하일 때는 5분 간격으로 집계
    if (hours <= 1) {
      const hourlySql = `
        SELECT 
          DATE_FORMAT(DATE_SUB(created_at, INTERVAL MINUTE(created_at) % 5 MINUTE), '%H:%i') as hour,
          COUNT(*) as requests,
          COUNT(DISTINCT ip_address) as unique_ips,
          SUM(bytes_sent) as bytes_sent,
          COUNT(*) / 300.0 as rps,
          AVG(response_time_ms) as avg_response_time
        FROM access_logs
        ${hourlyWhereClause}
        GROUP BY hour
        ORDER BY hour
      `;
      hourly = await query(hourlySql, hourlyParams);
    } else if (hours <= 24) {
      // 24시간 이하: 시간 단위
      const hourlySql = `
        SELECT 
          DATE_FORMAT(created_at, '%H:00') as hour,
          COUNT(*) as requests,
          COUNT(DISTINCT ip_address) as unique_ips,
          SUM(bytes_sent) as bytes_sent,
          COUNT(*) / 3600.0 as rps,
          AVG(response_time_ms) as avg_response_time
        FROM access_logs
        ${hourlyWhereClause}
        GROUP BY hour
        ORDER BY hour
      `;
      hourly = await query(hourlySql, hourlyParams);
    } else {
      // 7일 이상: 일 단위
      const hourlySql = `
        SELECT 
          DATE_FORMAT(created_at, '%m-%d') as hour,
          COUNT(*) as requests,
          COUNT(DISTINCT ip_address) as unique_ips,
          SUM(bytes_sent) as bytes_sent,
          COUNT(*) / 86400.0 as rps,
          AVG(response_time_ms) as avg_response_time
        FROM access_logs
        ${hourlyWhereClause}
        GROUP BY hour
        ORDER BY hour
      `;
      hourly = await query(hourlySql, hourlyParams);
    }

    // 일별 통계 (최근 7일) - 내부 IP 필터링 포함 (현재 기간만)
    let daily: any[] = [];
    if (offset === 0) {
      const dailyWhereClause = `WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND ip_address NOT IN ('127.0.0.1', 'localhost')
          AND ip_address NOT LIKE '127.%'
          AND ip_address NOT LIKE '10.%'
          AND ip_address NOT LIKE '172.1[6-9].%'
          AND ip_address NOT LIKE '172.2[0-9].%'
          AND ip_address NOT LIKE '172.3[0-1].%'
          AND ip_address NOT LIKE '192.168.%'
          AND ip_address REGEXP '^[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}$'${proxyHostId ? ' AND proxy_host_id = ?' : ''}`;
      
      const dailySql = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as requests,
          COUNT(DISTINCT ip_address) as unique_ips,
          SUM(bytes_sent) as bytes_sent
        FROM access_logs
        ${dailyWhereClause}
        GROUP BY date
        ORDER BY date DESC
      `;

      const dailyParams = proxyHostId ? [parseInt(proxyHostId, 10)] : [];
      daily = await query(dailySql, dailyParams);
    }

    return NextResponse.json({
      summary: {
        ...summary,
        peak_rps: peakRps,
        peak_hour: peakHour,
      },
      hourly,
      daily,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('트래픽 요약 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

