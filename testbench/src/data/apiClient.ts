/**
 * Standalone API client for Question & Mock Exam backend.
 * Provides resilient, typed data access with ETag revalidation, retries,
 * capability negotiation headers, and offline fallbacks.
 */

import type { Paper } from '@/core/schema';

export interface ExamSummary {
  code: string;
  name: string;
  badge: string;
  defaultMarkingStrategy: string;
  position: number;
  active: number;
  papersCount: number;
}

export interface PaperSummary {
  id: string;
  title: string;
  exam: string;
  examCode?: string;
  year: number;
  durationMin: number;
  totalQuestions: number;
  sectionsCount: number;
  badge?: string;
  status?: string;
  minClientVersion?: number;
  requiredFeatures?: string[];
}

export interface ManifestAsset {
  filename: string;
  sha256: string;
  bytes: number;
  role: string;
  url: string;
}

export interface PaperManifest {
  paperId: string;
  dataVersion: number;
  contentHash: string;
  assets: ManifestAsset[];
}

export interface MetaResponse {
  apiVersion: string;
  supportedSchemaVersions: string[];
  minSupportedClient: Record<string, string>;
  features: string[];
  serverTime: string;
}

export class OfflineError extends Error {
  constructor(message = 'Network request failed or offline') {
    super(message);
    this.name = 'OfflineError';
  }
}

export interface FetchJsonOptions {
  etag?: string;
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export interface FetchResult<T> {
  data: T | null;
  etag?: string;
  dataVersion?: number;
  status: number;
  notModified: boolean;
}

const DEFAULT_BASE_URL = 'http://localhost:8000/api/v1';

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  return DEFAULT_BASE_URL;
}

export function getDataSourceMode(): 'auto' | 'api' | 'static' {
  const mode = import.meta.env.VITE_DATA_SOURCE;
  if (mode === 'api' || mode === 'static' || mode === 'auto') {
    return mode;
  }
  return 'auto';
}

/**
 * Execute an idempotent GET request with ETag caching, retries, and timeout.
 */
export async function fetchJson<T>(
  path: string,
  options: FetchJsonOptions = {},
): Promise<FetchResult<T>> {
  const { etag, timeoutMs = 8000, retries = 2, headers: customHeaders = {} } = options;
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Client': 'web/0.0.3',
    'X-Schema-Max': '1',
    'X-Features': 'single,multi,numerical,tf',
    ...customHeaders,
  };

  if (etag) {
    headers['If-None-Match'] = etag;
  }

  let attempt = 0;
  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 304) {
        return {
          data: null,
          etag,
          status: 304,
          notModified: true,
        };
      }

      if (!response.ok) {
        if (response.status >= 500 && attempt < retries) {
          attempt++;
          await new Promise((res) => setTimeout(res, 300 * Math.pow(2, attempt)));
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const resEtag = response.headers.get('ETag') || undefined;
      const dataVerStr = response.headers.get('X-Data-Version');
      const dataVersion = dataVerStr ? parseInt(dataVerStr, 10) : undefined;
      const data = (await response.json()) as T;

      return {
        data,
        etag: resEtag,
        dataVersion,
        status: response.status,
        notModified: false,
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      if (attempt < retries) {
        attempt++;
        await new Promise((res) => setTimeout(res, 300 * Math.pow(2, attempt)));
        continue;
      }
      throw new OfflineError(err instanceof Error ? err.message : 'Network request failed');
    }
  }

  throw new OfflineError('Max retries exceeded');
}

/** Retrieve platform metadata */
export async function getMeta(): Promise<MetaResponse> {
  const res = await fetchJson<MetaResponse>('/meta');
  if (!res.data) throw new OfflineError('Empty metadata response');
  return res.data;
}

/** Retrieve active exams registry */
export async function getExams(): Promise<ExamSummary[]> {
  const res = await fetchJson<ExamSummary[]>('/exams');
  return res.data || [];
}

/** Retrieve papers catalog */
export async function getCatalog(filters?: {
  exam?: string;
  year?: number;
  q?: string;
}): Promise<PaperSummary[]> {
  const params = new URLSearchParams();
  if (filters?.exam) params.set('exam', filters.exam);
  if (filters?.year) params.set('year', String(filters.year));
  if (filters?.q) params.set('q', filters.q);

  const qs = params.toString();
  const path = `/papers${qs ? `?${qs}` : ''}`;
  const res = await fetchJson<{ items: PaperSummary[] }>(path);
  return res.data?.items || [];
}

/** Retrieve paper structure in TestBench CBT format */
export async function getPaper(
  paperId: string,
  etag?: string,
): Promise<FetchResult<Paper>> {
  return fetchJson<Paper>(`/papers/${paperId}`, { etag });
}

/** Retrieve paper asset manifest */
export async function getPaperManifest(
  paperId: string,
  etag?: string,
): Promise<FetchResult<PaperManifest>> {
  return fetchJson<PaperManifest>(`/papers/${paperId}/manifest`, { etag });
}

/** Retrieve paper and manifest together in one roundtrip */
export async function getPaperBundle(
  paperId: string,
  etag?: string,
): Promise<FetchResult<{ paper: Paper; manifest: PaperManifest }>> {
  return fetchJson<{ paper: Paper; manifest: PaperManifest }>(`/papers/${paperId}/bundle`, { etag });
}

/** Retrieve universal Q&A database JSON */
export async function getQna(
  qnaId: string,
  etag?: string,
): Promise<FetchResult<Record<string, unknown>>> {
  return fetchJson<Record<string, unknown>>(`/qna/${qnaId}`, { etag });
}

/** Build direct asset URL with optional cache-busting version parameter and variant width */
export function buildAssetUrl(
  paperId: string,
  filename: string,
  versionHash?: string,
  targetWidth?: number,
): string {
  const baseUrl = getApiBaseUrl();
  const cleanName = filename.startsWith('images/') ? filename.replace('images/', '') : filename;
  const params = new URLSearchParams();
  if (versionHash) params.set('v', versionHash.slice(0, 8));
  if (targetWidth) params.set('w', String(targetWidth));
  const qs = params.toString();
  return `${baseUrl}/assets/${paperId}/${cleanName}${qs ? `?${qs}` : ''}`;
}
