import { VideoStatus, canTransition } from './video-status';

export interface VideoProps {
  id: string;
  userId: string;
  originalName: string;
  storageKey: string;
  status: VideoStatus;
  frameIntervalSeconds: number;
  createdAt: Date;
  updatedAt: Date;
  zipKey?: string | null;
  frameCount?: number | null;
  durationMs?: number | null;
  sizeBytes?: number | null;
  errorReason?: string | null;
}

export interface ProcessingResult {
  zipKey: string;
  frameCount: number;
  durationMs: number;
  sizeBytes: number;
}

/**
 * A video and everything known about its processing.
 *
 * Every mutation goes through the status machine and returns whether it was
 * accepted. Rejected transitions are a normal occurrence — a redelivered event or
 * one that overtook another — so they are reported, never thrown.
 */
export class Video {
  readonly id: string;
  readonly userId: string;
  readonly originalName: string;
  readonly storageKey: string;
  readonly frameIntervalSeconds: number;
  readonly createdAt: Date;

  private _status: VideoStatus;
  private _zipKey: string | null;
  private _frameCount: number | null;
  private _durationMs: number | null;
  private _sizeBytes: number | null;
  private _errorReason: string | null;
  private _updatedAt: Date;

  constructor(props: VideoProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.originalName = props.originalName;
    this.storageKey = props.storageKey;
    this.frameIntervalSeconds = props.frameIntervalSeconds;
    this.createdAt = props.createdAt;

    this._status = props.status;
    this._updatedAt = props.updatedAt;
    this._zipKey = props.zipKey ?? null;
    this._frameCount = props.frameCount ?? null;
    this._durationMs = props.durationMs ?? null;
    this._sizeBytes = props.sizeBytes ?? null;
    this._errorReason = props.errorReason ?? null;
  }

  get status(): VideoStatus {
    return this._status;
  }
  get zipKey(): string | null {
    return this._zipKey;
  }
  get frameCount(): number | null {
    return this._frameCount;
  }
  get durationMs(): number | null {
    return this._durationMs;
  }
  get sizeBytes(): number | null {
    return this._sizeBytes;
  }
  get errorReason(): string | null {
    return this._errorReason;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  markProcessing(): boolean {
    return this.transitionTo(VideoStatus.PROCESSING);
  }

  markCompleted(result: ProcessingResult): boolean {
    if (!this.transitionTo(VideoStatus.COMPLETED)) return false;

    this._zipKey = result.zipKey;
    this._frameCount = result.frameCount;
    this._durationMs = result.durationMs;
    this._sizeBytes = result.sizeBytes;
    this._errorReason = null;
    return true;
  }

  markFailed(reason: string): boolean {
    if (!this.transitionTo(VideoStatus.FAILED)) return false;

    this._errorReason = reason;
    return true;
  }

  isDownloadable(): boolean {
    return this._status === VideoStatus.COMPLETED && this._zipKey !== null;
  }

  private transitionTo(next: VideoStatus): boolean {
    if (!canTransition(this._status, next)) return false;

    this._status = next;
    this._updatedAt = new Date();
    return true;
  }
}
