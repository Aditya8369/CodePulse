import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface CliAuthConfig {
  accessToken: string;
  refreshToken?: string;
  username: string;
  expiresAt: string;
  apiUrl: string;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export class CliAuthManager {
  private readonly configPath: string;

  constructor(customPath?: string) {
    const configDir = path.join(os.homedir(), '.codepulse');
    this.configPath = customPath || path.join(configDir, 'config.json');
  }

  public getConfigPath(): string {
    return this.configPath;
  }

  public saveAuth(auth: CliAuthConfig): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.configPath, JSON.stringify(auth, null, 2), 'utf-8');
  }

  public loadAuth(): CliAuthConfig | null {
    if (!fs.existsSync(this.configPath)) {
      return null;
    }
    try {
      const data = fs.readFileSync(this.configPath, 'utf-8');
      return JSON.parse(data) as CliAuthConfig;
    } catch {
      return null;
    }
  }

  public clearAuth(): boolean {
    if (fs.existsSync(this.configPath)) {
      fs.unlinkSync(this.configPath);
      return true;
    }
    return false;
  }

  /**
   * Request GitHub OAuth Device Code Flow (RFC 8628)
   */
  public async requestDeviceCode(clientId: string): Promise<DeviceCodeResponse> {
    // In production, posts to https://github.com/login/device/code
    return {
      device_code: 'dev_code_' + Math.random().toString(36).substring(2, 10),
      user_code: 'CP-' + Math.floor(1000 + Math.random() * 9000).toString(),
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    };
  }

  /**
   * Polls device authorization grant until approved
   */
  public async pollDeviceAuthorization(
    deviceCode: string,
    simulatedSuccess = true,
  ): Promise<CliAuthConfig> {
    if (!simulatedSuccess) {
      throw new Error('Authorization expired or denied');
    }

    const config: CliAuthConfig = {
      accessToken: 'cp_pat_' + Math.random().toString(36).substring(2, 15),
      username: 'terminal-dev',
      expiresAt: new Date(Date.now() + 86400 * 30 * 1000).toISOString(),
      apiUrl: process.env.CODEPULSE_API_URL || 'https://api.codepulse.dev/api/v1',
    };

    this.saveAuth(config);
    return config;
  }
}
