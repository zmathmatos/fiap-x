import type { ReactElement, ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '../src/features/auth/AuthProvider';
import type { VideoDetail, VideoSummary } from '../src/lib/types';

export const TEST_USER = {
  id: 'u1',
  name: 'Ana',
  email: 'ana@fiapx.local',
  createdAt: '2026-09-01T10:00:00.000Z',
};

export function videoSummary(overrides: Partial<VideoSummary> = {}): VideoSummary {
  return {
    id: 'v1',
    originalName: 'aula.mp4',
    title: null,
    displayName: 'aula.mp4',
    thumbnailUrl: null,
    status: 'COMPLETED',
    frameCount: 120,
    durationMs: 60_000,
    sizeBytes: 5_242_880,
    frameIntervalSeconds: 20,
    errorReason: null,
    downloadable: true,
    codec: 'h264',
    width: 1920,
    height: 1080,
    frameRate: 30,
    bitrateBps: 2_000_000,
    progressPercent: null,
    createdAt: '2026-09-27T10:00:00.000Z',
    updatedAt: '2026-09-27T10:05:00.000Z',
    ...overrides,
  };
}

export function videoDetail(overrides: Partial<VideoDetail> = {}): VideoDetail {
  return { ...videoSummary(), events: [], ...overrides };
}

export function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: TEST_USER,
    token: 'test-token',
    status: 'authenticated',
    login: async () => undefined,
    register: async () => undefined,
    logout: () => undefined,
    ...overrides,
  };
}

interface ProvidersOptions {
  auth?: Partial<AuthContextValue>;
  route?: string;
}

export function Providers({
  children,
  auth,
  route = '/',
}: ProvidersOptions & { children: ReactNode }): JSX.Element {
  return (
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider value={authValue(auth)}>{children}</AuthContext.Provider>
    </MemoryRouter>
  );
}

export function renderWithProviders(ui: ReactElement, options: ProvidersOptions = {}): RenderResult {
  return render(<Providers {...options}>{ui}</Providers>);
}

export function first<T>(elements: T[]): T {
  const [element] = elements;
  if (element === undefined) throw new Error('nenhum elemento encontrado');
  return element;
}

export function last<T>(elements: T[]): T {
  const element = elements.at(-1);
  if (element === undefined) throw new Error('nenhum elemento encontrado');
  return element;
}
