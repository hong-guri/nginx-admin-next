-- 프록시 호스트 상태 확인 테이블
CREATE TABLE IF NOT EXISTS proxy_host_status (
  id INT PRIMARY KEY AUTO_INCREMENT,
  proxy_host_id INT NOT NULL,
  status_code INT NULL COMMENT 'HTTP 상태 코드 (200, 404 등)',
  status_error VARCHAR(255) NULL COMMENT '오류 메시지 (Timeout, Connection failed 등)',
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_proxy_host_id (proxy_host_id),
  INDEX idx_checked_at (checked_at)
);

