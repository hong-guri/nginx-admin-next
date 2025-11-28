import { cookies } from 'next/headers';
import { NPMClient } from './npm-client';

export interface SessionData {
  email: string;
  npmToken: string;
  timestamp: number;
}

export async function getSession(): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (!token) {
      return null;
    }

    try {
      const decoded = JSON.parse(
        Buffer.from(token, 'base64').toString('utf-8')
      ) as SessionData;
      
      // 세션 만료 체크 (7일)
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - decoded.timestamp > sevenDays) {
        return null;
      }
      
      return decoded;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function getNPMClient(): Promise<NPMClient | null> {
  const session = await getSession();
  if (!session || !session.npmToken) {
    return null;
  }
  
  const client = new NPMClient(session.npmToken);
  const isValid = await client.ensureLoggedIn();
  
  if (!isValid) {
    return null;
  }
  
  return client;
}

