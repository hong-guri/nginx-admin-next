const mysql = require('mysql2/promise');
const https = require('https');
const http = require('http');

// 환경 변수 필수 체크
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'NPM_API_URL', 'NPM_USERNAME', 'NPM_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('필수 환경 변수가 설정되지 않았습니다:', missingVars.join(', '));
  console.error('환경 변수를 설정하거나 .env 파일을 확인하세요.');
  process.exit(1);
}

const DB_HOST = process.env.DB_HOST;
const DB_PORT = parseInt(process.env.DB_PORT || '3306');
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;
const NPM_API_URL = process.env.NPM_API_URL;
const NPM_USERNAME = process.env.NPM_USERNAME;
const NPM_PASSWORD = process.env.NPM_PASSWORD;

async function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function getNPMToken() {
  try {
    const response = await httpRequest(`${NPM_API_URL}/api/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: NPM_USERNAME,
        secret: NPM_PASSWORD,
      }),
    });

    if (response.status !== 200) {
      throw new Error(`NPM 인증 실패: ${response.status}`);
    }

    return response.data.token;
  } catch (error) {
    console.error('NPM 토큰 획득 실패:', error);
    throw error;
  }
}

async function getProxyHosts(token) {
  try {
    const response = await httpRequest(`${NPM_API_URL}/api/nginx/proxy-hosts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.status !== 200) {
      throw new Error(`프록시 호스트 조회 실패: ${response.status}`);
    }

    return response.data;
  } catch (error) {
    console.error('프록시 호스트 조회 오류:', error);
    throw error;
  }
}

async function checkHostStatus(domain, sslForced) {
  return new Promise((resolve) => {
    const protocol = sslForced ? https : http;
    const url = `${sslForced ? 'https' : 'http'}://${domain}`;
    
    const timeout = setTimeout(() => {
      resolve({ statusCode: null, error: 'Timeout' });
    }, 10000);

    const req = protocol.request(url, {
      method: 'HEAD',
      timeout: 10000,
      headers: {
        'User-Agent': 'Nginx-Proxy-Manager-Status-Checker/1.0',
      },
    }, (res) => {
      clearTimeout(timeout);
      resolve({ statusCode: res.statusCode, error: null });
    });

    req.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ 
        statusCode: null, 
        error: error.message || 'Connection failed' 
      });
    });

    req.on('timeout', () => {
      req.destroy();
      clearTimeout(timeout);
      resolve({ statusCode: null, error: 'Timeout' });
    });

    req.setTimeout(10000);
    req.end();
  });
}

async function updateStatusInDB(connection, proxyHostId, statusCode, statusError) {
  try {
    await connection.execute(
      `INSERT INTO proxy_host_status (proxy_host_id, status_code, status_error, checked_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         status_code = VALUES(status_code),
         status_error = VALUES(status_error),
         checked_at = NOW()`,
      [proxyHostId, statusCode, statusError]
    );
  } catch (error) {
    console.error(`프록시 호스트 ${proxyHostId} 상태 업데이트 실패:`, error);
  }
}

async function main() {
  let connection;
  
  try {
    console.log('프록시 호스트 상태 확인 시작...');
    
    // DB 연결
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
    });

    // NPM 토큰 획득
    const token = await getNPMToken();
    console.log('NPM 토큰 획득 완료');

    // 프록시 호스트 목록 조회
    const hosts = await getProxyHosts(token);
    console.log(`${hosts.length}개의 프록시 호스트 발견`);

    // 각 호스트 상태 확인
    for (let i = 0; i < hosts.length; i++) {
      const host = hosts[i];
      
      if (!host.enabled || !host.domain_names || host.domain_names.length === 0) {
        // 비활성화된 호스트는 상태를 null로 저장
        await updateStatusInDB(connection, host.id, null, '비활성화됨');
        continue;
      }

      const primaryDomain = host.domain_names[0];
      const sslForced = host.ssl_forced || false;
      
      console.log(`[${i + 1}/${hosts.length}] ${primaryDomain} 확인 중...`);
      
      const result = await checkHostStatus(primaryDomain, sslForced);
      
      await updateStatusInDB(connection, host.id, result.statusCode, result.error);
      
      if (result.statusCode) {
        console.log(`  ✓ 상태 코드: ${result.statusCode}`);
      } else {
        console.log(`  ✗ 오류: ${result.error}`);
      }

      // 서버 부하 방지를 위해 약간의 딜레이
      if (i < hosts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('프록시 호스트 상태 확인 완료');
  } catch (error) {
    console.error('상태 확인 중 오류 발생:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();

