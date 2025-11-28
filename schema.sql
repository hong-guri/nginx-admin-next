-- Nginx Admin Next 데이터베이스 스키마

-- 폴더 테이블
CREATE TABLE IF NOT EXISTS folders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  parent_id INT NULL,
  color VARCHAR(7) DEFAULT '#3b82f6',
  icon VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- 프록시 호스트-폴더 매핑
CREATE TABLE IF NOT EXISTS proxy_host_folders (
  proxy_host_id INT NOT NULL,
  folder_id INT NOT NULL,
  PRIMARY KEY (proxy_host_id, folder_id),
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- 트래픽 통계 테이블
CREATE TABLE IF NOT EXISTS traffic_stats (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  proxy_host_id INT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  request_count INT DEFAULT 0,
  bytes_sent BIGINT DEFAULT 0,
  bytes_received BIGINT DEFAULT 0,
  avg_response_time_ms INT DEFAULT 0,
  status_2xx INT DEFAULT 0,
  status_4xx INT DEFAULT 0,
  status_5xx INT DEFAULT 0,
  INDEX idx_proxy_host_timestamp (proxy_host_id, timestamp),
  UNIQUE KEY idx_proxy_host_timestamp_unique (proxy_host_id, timestamp)
);

-- 실시간 트래픽 (최근 1시간 데이터)
CREATE TABLE IF NOT EXISTS realtime_traffic (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  proxy_host_id INT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  request_count INT DEFAULT 1,
  response_time_ms INT DEFAULT 0,
  INDEX idx_proxy_host_timestamp (proxy_host_id, timestamp),
  UNIQUE KEY idx_proxy_host_timestamp_unique (proxy_host_id, timestamp)
);

-- 접속 로그 테이블 (실제 URL 접속 기록)
CREATE TABLE IF NOT EXISTS access_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  proxy_host_id INT NULL,
  url VARCHAR(500) NOT NULL,
  method VARCHAR(10) DEFAULT 'GET',
  status_code INT DEFAULT 200,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  referer VARCHAR(500) NULL,
  bytes_sent BIGINT DEFAULT 0,
  response_time_ms INT DEFAULT 0,
  log_timestamp TIMESTAMP NULL COMMENT '로그의 원본 타임스탬프 (중복 방지용)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_proxy_host_created (proxy_host_id, created_at),
  INDEX idx_url_created (url(255), created_at),
  INDEX idx_ip_created (ip_address, created_at),
  INDEX idx_log_timestamp (log_timestamp),
  UNIQUE KEY idx_duplicate_check (proxy_host_id, log_timestamp, url(255), ip_address, method)
);

-- IP 블랙리스트
CREATE TABLE IF NOT EXISTS ip_blacklist (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ip_address VARCHAR(45) NOT NULL UNIQUE,
  reason VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_ip_active (ip_address, is_active)
);

-- IP 화이트리스트
CREATE TABLE IF NOT EXISTS ip_whitelist (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ip_address VARCHAR(45) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_ip_active (ip_address, is_active)
);

-- 경로 블랙리스트 (프록시 호스트별)
CREATE TABLE IF NOT EXISTS path_blacklist (
  id INT PRIMARY KEY AUTO_INCREMENT,
  proxy_host_id INT NOT NULL,
  path_pattern VARCHAR(255) NOT NULL,
  description VARCHAR(255) NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_proxy_host_active (proxy_host_id, is_active)
);

-- 전역 경로 블랙리스트 (모든 프록시 호스트에 적용)
CREATE TABLE IF NOT EXISTS global_path_blacklist (
  id INT PRIMARY KEY AUTO_INCREMENT,
  path_pattern VARCHAR(255) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 보안 이벤트 로그
CREATE TABLE IF NOT EXISTS security_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  proxy_host_id INT NULL,
  event_type ENUM('BLOCKED_IP', 'BLOCKED_PATH', 'SUSPICIOUS_UA', 'RATE_LIMIT', 'VULNERABILITY_DETECTED') NOT NULL,
  ip_address VARCHAR(45) NULL,
  path VARCHAR(500) NULL,
  user_agent VARCHAR(500) NULL,
  details JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_type_created (event_type, created_at),
  INDEX idx_ip_created (ip_address, created_at)
);

-- 취약점 탐지 패턴
CREATE TABLE IF NOT EXISTS vulnerability_patterns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  pattern VARCHAR(255) NOT NULL,
  description TEXT NULL,
  severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'MEDIUM',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 기본 취약점 패턴 삽입
INSERT INTO vulnerability_patterns (name, pattern, description, severity) VALUES
('/wp-admin', 'WordPress 관리자 페이지', 'HIGH'),
('/.env', '환경 변수 파일 노출', 'CRITICAL'),
('/phpmyadmin', 'phpMyAdmin 접근', 'HIGH'),
('/admin', '관리자 페이지', 'MEDIUM'),
('/.git', 'Git 저장소 노출', 'HIGH'),
('/backup', '백업 파일', 'MEDIUM'),
('/tmp', '임시 파일 디렉토리', 'LOW'),
('/shell', '쉘 스크립트', 'HIGH'),
('/cmd', '명령 실행', 'HIGH'),
('/xmlrpc.php', 'WordPress XML-RPC', 'MEDIUM'),
('/wp-config.php', 'WordPress 설정 파일', 'CRITICAL'),
('/setup-config.php', 'WordPress 설정', 'HIGH')
ON DUPLICATE KEY UPDATE name=name;

