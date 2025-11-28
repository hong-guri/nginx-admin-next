import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24', 10);

    // 이벤트 타입별 통계
    const eventTypeStats = await query<{ event_type: string; count: number }[]>(
      `SELECT event_type, COUNT(*) as count
       FROM security_events
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       GROUP BY event_type
       ORDER BY count DESC`,
      [hours]
    );

    // 심각도별 통계
    const severityStats = await query<{ severity: string; count: number }[]>(
      `SELECT 
        CASE 
          WHEN JSON_EXTRACT(details, '$.severity') = 'CRITICAL' THEN 'CRITICAL'
          WHEN JSON_EXTRACT(details, '$.severity') = 'HIGH' THEN 'HIGH'
          WHEN JSON_EXTRACT(details, '$.severity') = 'MEDIUM' THEN 'MEDIUM'
          WHEN JSON_EXTRACT(details, '$.severity') = 'LOW' THEN 'LOW'
          ELSE 'UNKNOWN'
        END as severity,
        COUNT(*) as count
       FROM security_events
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       GROUP BY severity
       ORDER BY 
         CASE severity
           WHEN 'CRITICAL' THEN 1
           WHEN 'HIGH' THEN 2
           WHEN 'MEDIUM' THEN 3
           WHEN 'LOW' THEN 4
           ELSE 5
         END`,
      [hours]
    );

    // 시간대별 이벤트 수
    const hourlyEvents = await query<{ hour: string; count: number }[]>(
      `SELECT 
        DATE_FORMAT(created_at, '%H:00') as hour,
        COUNT(*) as count
       FROM security_events
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       GROUP BY hour
       ORDER BY hour`,
      [hours]
    );

    // 상위 위협 IP
    const topThreatIPs = await query<{ ip_address: string; count: number; latest_event: Date }[]>(
      `SELECT 
        ip_address,
        COUNT(*) as count,
        MAX(created_at) as latest_event
       FROM security_events
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       AND ip_address IS NOT NULL
       GROUP BY ip_address
       ORDER BY count DESC
       LIMIT 10`,
      [hours]
    );

    // 최근 위협 경로
    const topThreatPaths = await query<{ path: string; count: number }[]>(
      `SELECT 
        path,
        COUNT(*) as count
       FROM security_events
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       AND path IS NOT NULL
       GROUP BY path
       ORDER BY count DESC
       LIMIT 10`,
      [hours]
    );

    // 총 이벤트 수
    const totalEvents = await query<{ count: number }[]>(
      `SELECT COUNT(*) as count
       FROM security_events
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
      [hours]
    );

    return NextResponse.json({
      totalEvents: totalEvents[0]?.count || 0,
      eventTypeStats,
      severityStats,
      hourlyEvents,
      topThreatIPs,
      topThreatPaths,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('보안 통계 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

