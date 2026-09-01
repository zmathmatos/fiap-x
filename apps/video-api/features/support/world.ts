import { randomUUID } from 'node:crypto';
import { setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';

export const BASE_URL = process.env.BDD_BASE_URL ?? 'http://localhost:3000';
export const MAILHOG_URL = process.env.BDD_MAILHOG_URL ?? 'http://localhost:8025';

export interface Session {
  email: string;
  password: string;
  token: string;
}

export interface MailhogMessage {
  Content: { Headers: Record<string, string[]> };
}

export class FiapxWorld extends World {
  sessions: Session[] = [];
  videoIds: string[] = [];
  lastStatus = 0;
  lastBody: unknown = null;
  lastZip: Buffer | null = null;

  constructor(options: IWorldOptions) {
    super(options);
  }

  get session(): Session {
    const first = this.sessions[0];
    if (!first) throw new Error('Nenhuma sessão criada neste cenário.');
    return first;
  }

  get videoId(): string {
    const first = this.videoIds[0];
    if (!first) throw new Error('Nenhum vídeo enviado neste cenário.');
    return first;
  }

  /** Registers a fresh account so scenarios never share state. */
  async createUser(): Promise<Session> {
    const email = `bdd-${randomUUID()}@fiapx.local`;
    const password = 'senha-super-secreta';

    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Usuário BDD', email, password }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao registrar usuário: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as { token: string };
    const session: Session = { email, password, token: body.token };
    this.sessions.push(session);
    return session;
  }

  authedFetch(path: string, init: RequestInit = {}, session = this.session): Promise<Response> {
    return fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${session.token}`,
      },
    });
  }
}

setWorldConstructor(FiapxWorld);
