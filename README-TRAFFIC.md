# 트래픽 데이터 수집 가이드

## 개요

NPM의 프록시 호스트로 접속하는 실제 트래픽을 자동으로 수집하는 방법을 안내합니다.

## 현재 상태

현재 구현된 `/api/traffic/collect`는 **수동 호출** 방식입니다. 실제 NPM 프록시 호스트로 접속하는 트래픽을 자동으로 수집하려면 추가 설정이 필요합니다.

## 자동 수집 방법

### 방법 1: Nginx 로그 파싱 (권장)

NPM의 Nginx access.log를 주기적으로 파싱하여 데이터를 수집합니다.

#### 1. 로그 파서 스크립트 생성

```bash
# nginx-log-parser.sh
#!/bin/bash

LOG_FILE="/data/logs/proxy-host-*_access.log"
COLLECT_API="http://nginx-admin-next:3000/api/traffic/webhook"

# 로그 파일 파싱 (Nginx 표준 로그 포맷)
tail -f $LOG_FILE | while read line; do
  # 로그 파싱 (예시)
  # 실제 로그 포맷에 맞게 수정 필요
  echo "$line" | awk '{print $1, $7, $9, $10}' | while read ip url status bytes; do
    curl -X POST "$COLLECT_API" \
      -H "Content-Type: application/json" \
      -d "{
        \"url\": \"$url\",
        \"statusCode\": $status,
        \"bytesSent\": $bytes,
        \"ipAddress\": \"$ip\"
      }"
  done
done
```

#### 2. Docker Compose에 로그 파서 서비스 추가

```yaml
services:
  nginx-log-parser:
    image: node:24-alpine
    volumes:
      - ./nginx-log-parser:/app
      - npm_data:/data/logs:ro  # NPM 로그 마운트
    command: sh -c "npm install && node parser.js"
    networks:
      - gatsby_network
    depends_on:
      - nginx-admin-next
```

### 방법 2: NPM의 로그 파일 직접 읽기

NPM 컨테이너의 로그 파일을 직접 읽어서 파싱합니다.

```typescript
// src/lib/nginx-log-parser.ts
import fs from 'fs';
import { collectTrafficData, findProxyHostIdByDomain } from './traffic-collector';

export async function parseNginxLog(logLine: string) {
  // Nginx 로그 포맷 파싱
  // 예: 192.168.1.1 - - [25/Dec/2024:10:00:00 +0000] "GET /test HTTP/1.1" 200 1024 "-" "Mozilla/5.0"
  const regex = /^(\S+) - - \[([^\]]+)\] "(\S+) (\S+) ([^"]+)" (\d+) (\d+) "([^"]*)" "([^"]*)"$/;
  const match = logLine.match(regex);
  
  if (!match) return;
  
  const [, ip, , method, url, , statusCode, bytesSent, referer, userAgent] = match;
  
  // Host 헤더는 로그에서 추출 불가하므로, URL이나 다른 방법으로 프록시 호스트 찾기
  // 또는 로그 파일명에서 프록시 호스트 ID 추출
  
  await collectTrafficData({
    proxyHostId: null, // 로그에서 추출 필요
    url,
    method,
    statusCode: parseInt(statusCode),
    responseTime: 0, // 로그에 없으면 0
    bytesSent: parseInt(bytesSent),
    ipAddress: ip,
    userAgent,
    referer: referer !== '-' ? referer : undefined,
  });
}
```

### 방법 3: NPM API 활용 (제한적)

NPM API를 통해 통계를 가져올 수 있지만, 상세 로그는 제공하지 않을 수 있습니다.

## 웹훅 엔드포인트

`/api/traffic/webhook` 엔드포인트를 사용하면 외부 시스템에서 트래픽 데이터를 전송할 수 있습니다.

### 요청 예시

```bash
curl -X POST http://localhost:55555/api/traffic/webhook \
  -H "Content-Type: application/json" \
  -H "Host: example.com" \
  -d '{
    "url": "/test",
    "method": "GET",
    "statusCode": 200,
    "responseTime": 50,
    "bytesSent": 1024,
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }'
```

Host 헤더를 통해 자동으로 프록시 호스트 ID를 찾습니다.

## 수동 테스트

현재 구현으로 수동 테스트:

```bash
curl -X POST http://localhost:55555/api/traffic/collect \
  -H "Content-Type: application/json" \
  -H "Host: your-domain.com" \
  -d '{
    "url": "/test",
    "method": "GET",
    "statusCode": 200,
    "responseTime": 50,
    "bytesSent": 1024
  }'
```

## 주의사항

1. **자동 수집을 위해서는 추가 구현 필요**: 현재는 수동 호출만 가능합니다.
2. **로그 파일 접근 권한**: NPM의 로그 파일에 접근할 수 있는 권한이 필요합니다.
3. **성능 고려**: 대량의 트래픽이 있는 경우 비동기 처리와 배치 처리 필요합니다.

## 방법 2: NPM 로그 파일 모니터링 (구현 완료)

NPM 컨테이너의 로그 파일을 실시간으로 모니터링하는 서비스가 추가되었습니다.

### 설정

1. **Docker Compose에 로그 워처 서비스 추가됨**
   - `nginx-log-watcher` 서비스가 자동으로 시작됩니다
   - NPM의 로그 디렉토리를 읽기 전용으로 마운트합니다

2. **환경 변수 설정**
   ```yaml
   environment:
     - NPM_LOG_DIR=/data/logs
     - TRAFFIC_API_URL=http://nginx-admin-next:3000/api/traffic/log-parser
     - WATCH_INTERVAL=1000  # 1초마다 체크
   ```

3. **서비스 시작**
   ```bash
   docker compose up -d nginx-log-watcher
   ```

### 작동 방식

1. `nginx-log-watcher` 서비스가 `/data/logs` 디렉토리를 모니터링합니다
2. `proxy-host-*_access.log` 파일을 찾아 새 로그 라인을 읽습니다
3. 각 로그 라인을 파싱하여 `/api/traffic/log-parser`로 전송합니다
4. API는 로그를 파싱하고 트래픽 데이터를 데이터베이스에 저장합니다

### 로그 확인

```bash
# 로그 워처 서비스 로그 확인
docker compose logs -f nginx-log-watcher

# 특정 시간 이후 로그
docker compose logs --since 1h nginx-log-watcher
```

### 문제 해결

1. **로그 파일을 찾을 수 없는 경우**
   - NPM의 로그 디렉토리 경로 확인
   - 볼륨 마운트 확인: `docker compose config`

2. **API 호출 실패**
   - `nginx-admin-next` 서비스가 실행 중인지 확인
   - 네트워크 연결 확인: `docker network inspect gatsby_network`

3. **권한 오류**
   - 로그 디렉토리 읽기 권한 확인
   - 볼륨이 `:ro` (read-only)로 마운트되어 있는지 확인

## 향후 개선 사항

- [x] Nginx 로그 파서 서비스 자동화
- [x] 실시간 로그 스트리밍
- [ ] 배치 처리 최적화
- [ ] 로그 로테이션 처리
- [ ] 성능 모니터링 및 알림

