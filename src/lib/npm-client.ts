import axios, { AxiosInstance } from 'axios';

// NPM API URL 환경 변수 체크
if (!process.env.NPM_API_URL) {
  throw new Error('NPM_API_URL 환경 변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
}

const NPM_API_URL = process.env.NPM_API_URL;

export class NPMClient {
  private token: string = '';
  private axiosInstance: AxiosInstance;

  constructor(token?: string) {
    this.axiosInstance = axios.create({
      baseURL: NPM_API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      maxRedirects: 0,
      timeout: 30000,
    });
    
    if (token) {
      this.token = token;
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
    }
  }

  async login(email: string, password: string): Promise<{ success: boolean; token?: string }> {
    try {
      const response = await this.axiosInstance.post('/api/tokens', {
        identity: email,
        secret: password,
      });

      this.token = response.data.token;
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
      
      return { success: true, token: this.token };
    } catch (error: any) {
      console.error('[NPM] 로그인 실패:', error.response?.data || error.message);
      return { success: false };
    }
  }

  setToken(token: string) {
    this.token = token;
    this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
  }

  async ensureLoggedIn(): Promise<boolean> {
    if (!this.token) {
      return false;
    }
    
    // 토큰 유효성 검사
    try {
      await this.axiosInstance.get('/api/schema');
      return true;
    } catch (error: any) {
      if (error.response?.status === 401) {
        this.token = '';
        return false;
      }
      return true;
    }
  }

  async getProxyHosts(): Promise<any[]> {
    try {
      await this.ensureLoggedIn();
      const response = await this.axiosInstance.get('/api/nginx/proxy-hosts');
      return response.data;
    } catch (error: any) {
      console.error('[NPM] 프록시 호스트 조회 실패:', error.response?.data || error.message);
      return [];
    }
  }

  async getProxyHost(id: number): Promise<any | null> {
    try {
      await this.ensureLoggedIn();
      const { data } = await this.axiosInstance.get(`/api/nginx/proxy-hosts/${id}`);
      return data;
    } catch (error: any) {
      console.error('[NPM] 프록시 호스트 상세 조회 실패:', error.response?.data || error.message);
      return null;
    }
  }

  async createProxyHost(data: any): Promise<number | null> {
    try {
      await this.ensureLoggedIn();
      const response = await this.axiosInstance.post('/api/nginx/proxy-hosts', data);
      return response.data.id;
    } catch (error: any) {
      console.error('[NPM] 프록시 호스트 생성 실패:', error.response?.data || error.message);
      return null;
    }
  }

  async updateProxyHost(id: number, data: any): Promise<boolean> {
    try {
      await this.ensureLoggedIn();
      await this.axiosInstance.put(`/api/nginx/proxy-hosts/${id}`, data);
      return true;
    } catch (error: any) {
      console.error('[NPM] 프록시 호스트 업데이트 실패:', error.response?.data || error.message);
      return false;
    }
  }

  async deleteProxyHost(id: number): Promise<boolean> {
    try {
      await this.ensureLoggedIn();
      await this.axiosInstance.delete(`/api/nginx/proxy-hosts/${id}`);
      return true;
    } catch (error: any) {
      console.error('[NPM] 프록시 호스트 삭제 실패:', error.response?.data || error.message);
      return false;
    }
  }

  async getCertificates(): Promise<any[]> {
    try {
      await this.ensureLoggedIn();
      const response = await this.axiosInstance.get('/api/nginx/certificates');
      return response.data;
    } catch (error: any) {
      console.error('[NPM] 인증서 목록 조회 실패:', error.response?.data || error.message);
      return [];
    }
  }

  async requestCertificate(data: {
    provider: 'letsencrypt';
    domain_names: string[];
    meta: {
      letsencrypt_email: string;
      letsencrypt_agree: boolean;
      dns_challenge?: boolean;
    };
  }): Promise<any | null> {
    try {
      await this.ensureLoggedIn();
      const response = await this.axiosInstance.post('/api/nginx/certificates', {
        provider: data.provider,
        domain_names: data.domain_names,
        meta: data.meta,
      });
      return response.data;
    } catch (error: any) {
      console.error('[NPM] 인증서 발급 실패:', error.response?.data || error.message);
      return null;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${NPM_API_URL}/api/schema`);
      return response.status === 200;
    } catch (error) {
      console.error('[NPM] 상태 확인 실패:', error);
      return false;
    }
  }
}

// 싱글톤 인스턴스는 더 이상 사용하지 않음
// 각 요청마다 토큰을 전달하여 새 인스턴스 생성

