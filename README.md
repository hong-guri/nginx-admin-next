# Nginx Admin Next

nginx-proxy-manager의 부족한 기능을 보완하는 관리자 페이지입니다.

## 주요 기능

- 📁 **폴더링**: 프록시 호스트를 폴더로 정리하여 관리
- 📱 **모바일 대응**: 반응형 디자인으로 모바일에서도 사용 가능
- 🔒 **보안 관리**: IP 블랙리스트/화이트리스트, 경로 블랙리스트, 취약점 탐지
- 📊 **트래픽 모니터링**: 실시간 트래픽 및 통계 데이터 시각화
- 🎨 **커스텀 UI**: Tailwind CSS v4 기반의 현대적인 UI

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 `.env.example` 파일을 참고하여 환경에 맞게 설정하세요:

```bash
cp .env.example .env
```

필수 환경 변수:
- `NPM_API_URL`: Nginx Proxy Manager API URL
  - Docker 네트워크 내부: `http://nginx-proxy-manager:81`
  - 외부 접근: `http://your-npm-host:81`
- `DB_HOST`: MySQL 호스트 주소
- `DB_USER`: MySQL 사용자명
- `DB_PASSWORD`: MySQL 비밀번호
- `DB_NAME`: 데이터베이스 이름

선택 환경 변수:
- `NPM_USERNAME`, `NPM_PASSWORD`: 상태 확인 스크립트용 (웹 앱 로그인과는 별개)
- `NPM_LOG_DIR`: Nginx 로그 디렉토리 경로 (기본값: `/data/logs`)
- `APP_PORT`: Next.js 앱 외부 포트 (기본값: `3000`)

**참고**: 
- 웹 애플리케이션 로그인은 nginx-proxy-manager의 실제 계정으로 진행됩니다.
- `NPM_USERNAME`과 `NPM_PASSWORD`는 상태 확인 스크립트에서만 사용됩니다.

### 3. 데이터베이스 스키마 생성

MySQL에 접속하여 `schema.sql` 파일을 실행하세요:

```bash
mysql -u root -p nginx_admin < schema.sql
```

### 4. 개발 서버 실행

#### 로컬 개발 (Docker 없이)

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

#### Docker Compose 사용

```bash
# 개발 모드
docker compose up

# 프로덕션 모드 (compose.yaml의 command 주석 변경 필요)
docker compose up -d
```

**중요**: Docker Compose를 사용하는 경우:
1. `compose.yaml`의 `NPM_LOG_VOLUME` 환경 변수를 실제 NPM 로그 디렉토리 경로로 설정하세요.
2. NPM이 다른 Docker 네트워크에 있는 경우, 해당 네트워크를 `compose.yaml`에 추가하세요.

## 기술 스택

- **Next.js 16**: React 프레임워크
- **Tailwind CSS v4**: 유틸리티 우선 CSS 프레임워크
- **MySQL**: 데이터베이스
- **Recharts**: 차트 라이브러리
- **TypeScript**: 타입 안정성

## 인증 및 자동 로그인

- nginx-proxy-manager의 실제 계정으로 로그인
- 세션 토큰 기반 자동 로그인 (7일간 유지)
- 페이지 로드 시 자동 인증 체크
- 인증 만료 시 자동으로 로그인 페이지로 리다이렉트

## 기능 상세

### 폴더링
- 프록시 호스트를 폴더로 그룹화
- 드래그 앤 드롭으로 폴더 이동 (향후 구현)
- 폴더별 색상 및 아이콘 설정

### 보안 기능
- **IP 블랙리스트**: 특정 IP 주소 차단
- **IP 화이트리스트**: 특정 IP 주소 허용
- **경로 블랙리스트**: 특정 경로 접근 차단 (프록시 호스트별 또는 전역)
- **취약점 탐지**: `/wp-admin`, `/.env` 등 보안 취약 경로 자동 탐지
- **보안 이벤트 로그**: 모든 보안 이벤트 기록 및 조회

### 트래픽 모니터링
- 실시간 트래픽 차트
- 요청 수 및 응답 시간 통계
- 시간대별 트렌드 분석

## 라이선스

MIT
