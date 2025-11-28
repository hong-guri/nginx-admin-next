import { NextRequest, NextResponse } from 'next/server';
import { processLogLine } from '@/lib/nginx-log-parser';

/**
 * 로그 파서 API
 * 외부에서 로그 라인을 전송하여 트래픽 데이터 수집
 * 인증 없이 호출 가능 (로그 워처 서비스에서 사용)
 */
export async function POST(request: NextRequest) {
  try {
    // 요청 본문 읽기 (빈 본문 처리)
    let body;
    try {
      const text = await request.text();
      if (!text || text.trim() === '') {
        return NextResponse.json(
          { error: '요청 본문이 비어있습니다.' },
          { status: 400 }
        );
      }
      body = JSON.parse(text);
    } catch (parseError: any) {
      console.error('[Log Parser] JSON 파싱 오류:', parseError.message);
      return NextResponse.json(
        { error: '유효하지 않은 JSON 형식입니다.' },
        { status: 400 }
      );
    }

    const { logLine, logLines, proxyHostId, host, filename } = body;

    // 배치 처리 (logLines 배열) 또는 단일 처리 (logLine)
    const linesToProcess = logLines && Array.isArray(logLines) ? logLines : (logLine ? [logLine] : []);

    if (linesToProcess.length === 0) {
      return NextResponse.json(
        { error: 'logLine 또는 logLines 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    // 파일명에서 프록시 호스트 ID 추출 시도
    let extractedHostId = proxyHostId;
    if (!extractedHostId && filename) {
      const { extractProxyHostIdFromFilename } = await import('@/lib/nginx-log-parser');
      extractedHostId = extractProxyHostIdFromFilename(filename);
    }

    // Host 헤더에서 도메인 추출
    const requestHost = request.headers.get('host') || 
                       request.headers.get('x-forwarded-host') ||
                       host ||
                       '';

    // 모든 로그 라인 처리 (비동기, 에러 무시)
    const processPromises = linesToProcess.map(line => 
      processLogLine(line, extractedHostId, requestHost).catch(err => {
        console.error('[Log Parser] 로그 처리 오류:', err);
      })
    );

    // 모든 처리를 기다리지 않고 즉시 응답 반환 (비동기 처리)
    Promise.all(processPromises).catch(() => {
      // 에러는 이미 개별적으로 처리됨
    });

    // 즉시 응답 반환
    return NextResponse.json({ success: true, processed: linesToProcess.length });
  } catch (error: any) {
    console.error('로그 파서 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

