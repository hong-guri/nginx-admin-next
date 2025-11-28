import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const whitelist = await query<{
      id: number;
      ip_address: string;
      description: string | null;
      is_active: boolean;
    }>('SELECT * FROM ip_whitelist ORDER BY created_at DESC');

    return NextResponse.json(whitelist);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('IP 화이트리스트 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const { ip_address, description } = await request.json();

    if (!ip_address) {
      return NextResponse.json(
        { error: 'IP 주소를 입력해주세요.' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO ip_whitelist (ip_address, description) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE 
       description = VALUES(description), 
       is_active = TRUE`,
      [ip_address, description || null]
    );

    const id = (result as any).insertId || (await query(
      'SELECT id FROM ip_whitelist WHERE ip_address = ?',
      [ip_address]
    ) as any)[0]?.id;

    return NextResponse.json({ id });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('IP 화이트리스트 추가 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

