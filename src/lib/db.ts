import mysql from 'mysql2/promise';

// 필수 환경 변수 체크
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(`필수 환경 변수가 설정되지 않았습니다: ${missingVars.join(', ')}. .env 파일을 확인하세요.`);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<T> {
  const [rows] = await pool.execute(sql, params);
  return rows as T;
}

export async function queryOne<T = any>(
  sql: string,
  params?: any[]
): Promise<T | null> {
  const [rows] = await pool.execute(sql, params);
  const result = rows as any[];
  return result.length > 0 ? (result[0] as T) : null;
}

export async function execute(sql: string, params?: any[]): Promise<any> {
  const [result] = await pool.execute(sql, params);
  return result;
}

export { pool };

