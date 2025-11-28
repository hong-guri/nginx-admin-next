import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getNPMClient } from '@/lib/auth';
import { query } from '@/lib/db';

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

    const proxyHosts = await npmClient.getProxyHosts();

    // 폴더 정보 및 상태 정보 포함
    const hostsWithFolders = await Promise.all(
      proxyHosts.map(async (host: any) => {
        const folders = await query<{ folder_id: number; name: string; color: string }>(
          `SELECT f.id as folder_id, f.name, f.color 
           FROM folders f
           INNER JOIN proxy_host_folders phf ON f.id = phf.folder_id
           WHERE phf.proxy_host_id = ?`,
          [host.id]
        );
        
        // 상태 정보 조회
        const status = await query<Array<{ status_code: number | null; status_error: string | null; checked_at: Date }>>(
          `SELECT status_code, status_error, checked_at
           FROM proxy_host_status
           WHERE proxy_host_id = ?`,
          [host.id]
        );
        
        return {
          ...host,
          folders: folders || [],
          statusCode: status[0]?.status_code ?? undefined,
          statusError: status[0]?.status_error ?? undefined,
          statusCheckedAt: status[0]?.checked_at ? new Date(status[0].checked_at).toISOString() : undefined,
        };
      })
    );

    return NextResponse.json(hostsWithFolders);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('프록시 호스트 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const npmClient = await getNPMClient();
    
    if (!npmClient) {
      return NextResponse.json(
        { error: '인증이 만료되었습니다. 다시 로그인해주세요.' },
        { status: 401 }
      );
    }

    const requestData = await request.json();
    
    // folderIds는 별도로 처리하므로 NPM API에 보내지 않음
    const { folderIds, ...npmData } = requestData;
    
    const hostId = await npmClient.createProxyHost(npmData);

    if (!hostId) {
      return NextResponse.json(
        { error: '프록시 호스트 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 폴더 매핑
    if (folderIds && Array.isArray(folderIds) && folderIds.length > 0) {
      for (const folderId of folderIds) {
        await query(
          `INSERT INTO proxy_host_folders (proxy_host_id, folder_id) 
           VALUES (?, ?) 
           ON DUPLICATE KEY UPDATE proxy_host_id=proxy_host_id`,
          [hostId, folderId]
        );
      }
    }

    return NextResponse.json({ id: hostId });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('프록시 호스트 생성 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

