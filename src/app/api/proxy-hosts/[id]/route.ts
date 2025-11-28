import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getNPMClient } from '@/lib/auth';
import { query } from '@/lib/db';
import { generateNginxSecurityConfig } from '@/lib/security';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const npmClient = await getNPMClient();
    
    if (!npmClient) {
      return NextResponse.json(
        { error: '인증이 만료되었습니다. 다시 로그인해주세요.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const hostId = parseInt(id);

    const host = await npmClient.getProxyHost(hostId);
    if (!host) {
      return NextResponse.json(
        { error: '프록시 호스트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 폴더 정보 포함
    const folders = await query<{ folder_id: number; name: string; color: string }>(
      `SELECT f.id as folder_id, f.name, f.color 
       FROM folders f
       INNER JOIN proxy_host_folders phf ON f.id = phf.folder_id
       WHERE phf.proxy_host_id = ?`,
      [hostId]
    );

    return NextResponse.json({
      ...host,
      folders: folders || [],
    });
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const npmClient = await getNPMClient();
    
    if (!npmClient) {
      return NextResponse.json(
        { error: '인증이 만료되었습니다. 다시 로그인해주세요.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const hostId = parseInt(id);
    const requestData = await request.json();

    // folderIds는 별도로 처리하므로 NPM API에 보내지 않음
    const { folderIds, ...npmData } = requestData;

    // NPM API가 허용하는 필드만 필터링
    const allowedFields = [
      'domain_names',
      'forward_scheme',
      'forward_host',
      'forward_port',
      'ssl_forced',
      'enabled',
      'block_exploits',
      'caching_enabled',
      'allow_websocket_upgrade',
      'advanced_config',
      'certificate_id',
    ];

    const filteredNpmData: any = {};
    for (const key of allowedFields) {
      if (key in npmData && npmData[key] !== undefined) {
        filteredNpmData[key] = npmData[key];
      }
    }

    // NPM 데이터가 있는 경우에만 업데이트 (폴더만 변경하는 경우 스킵)
    if (Object.keys(filteredNpmData).length > 0) {
      // 기존 호스트 정보 가져오기
      const currentHost = await npmClient.getProxyHost(hostId);
      if (!currentHost) {
        return NextResponse.json(
          { error: '프록시 호스트를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      // domain_names는 필수이므로 현재 값 사용
      if (!filteredNpmData.domain_names && currentHost.domain_names) {
        filteredNpmData.domain_names = currentHost.domain_names;
      }

      // 보안 설정 자동 주입
      const securityConfig = await generateNginxSecurityConfig(hostId);
      if (securityConfig) {
        filteredNpmData.advanced_config = (filteredNpmData.advanced_config || currentHost.advanced_config || '') + '\n' + securityConfig;
      }

      const success = await npmClient.updateProxyHost(hostId, filteredNpmData);

      if (!success) {
        return NextResponse.json(
          { error: '프록시 호스트 업데이트에 실패했습니다.' },
          { status: 500 }
        );
      }
    }

    // 폴더 매핑 업데이트
    if (folderIds !== undefined) {
      // 기존 매핑 삭제
      await query(
        'DELETE FROM proxy_host_folders WHERE proxy_host_id = ?',
        [hostId]
      );

      // 새 매핑 추가
      if (Array.isArray(folderIds)) {
        for (const folderId of folderIds) {
          await query(
            `INSERT INTO proxy_host_folders (proxy_host_id, folder_id) 
             VALUES (?, ?)`,
            [hostId, folderId]
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('프록시 호스트 업데이트 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const npmClient = await getNPMClient();
    
    if (!npmClient) {
      return NextResponse.json(
        { error: '인증이 만료되었습니다. 다시 로그인해주세요.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const hostId = parseInt(id);

    // 폴더 매핑 삭제
    await query(
      'DELETE FROM proxy_host_folders WHERE proxy_host_id = ?',
      [hostId]
    );

    const success = await npmClient.deleteProxyHost(hostId);

    if (!success) {
      return NextResponse.json(
        { error: '프록시 호스트 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('프록시 호스트 삭제 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

