import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getNPMClient } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const npmClient = await getNPMClient();
    
    if (!npmClient) {
      return NextResponse.json(
        { error: '인증이 만료되었습니다. 다시 로그인해주세요.' },
        { status: 401 }
      );
    }

    const certificates = await npmClient.getCertificates();
    return NextResponse.json(certificates);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('인증서 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const npmClient = await getNPMClient();
    
    if (!npmClient) {
      return NextResponse.json(
        { error: '인증이 만료되었습니다. 다시 로그인해주세요.' },
        { status: 401 }
      );
    }

    const data = await request.json();
    
    // 세션에서 이메일을 가져와서 사용 (클라이언트에서 전달된 이메일이 없거나 다른 경우)
    if (!data.meta?.letsencrypt_email && session.email) {
      data.meta = data.meta || {};
      data.meta.letsencrypt_email = session.email;
    }

    const certificate = await npmClient.requestCertificate(data);

    if (!certificate) {
      return NextResponse.json(
        { error: '인증서 발급에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json(certificate);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('인증서 발급 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

