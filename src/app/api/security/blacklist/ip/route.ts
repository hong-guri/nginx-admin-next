import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const blacklist = await query<{
      id: number;
      ip_address: string;
      reason: string | null;
      expires_at: Date | null;
      is_active: boolean;
    }>('SELECT * FROM ip_blacklist ORDER BY created_at DESC');

    return NextResponse.json(blacklist);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('IP 블랙리스트 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const { ip_address, reason, expires_at } = await request.json();

    if (!ip_address) {
      return NextResponse.json(
        { error: 'IP 주소를 입력해주세요.' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO ip_blacklist (ip_address, reason, expires_at) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       reason = VALUES(reason), 
       expires_at = VALUES(expires_at), 
       is_active = TRUE`,
      [ip_address, reason || null, expires_at || null]
    );

    const id = (result as any).insertId || (await queryOne<{ id: number }>(
      'SELECT id FROM ip_blacklist WHERE ip_address = ?',
      [ip_address]
    ))?.id;

    return NextResponse.json({ id });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('IP 블랙리스트 추가 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

