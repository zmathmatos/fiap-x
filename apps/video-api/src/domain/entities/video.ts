import { VideoStatus, canTransition } from './video-status';
import type { VideoTitle } from '../value-objects/video-title';

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
  codec?: string | null;
  width?: number | null;
  height?: number | null;
  frameRate?: number | null;
  bitrateBps?: number | null;
  title?: string | null;
  thumbnailKey?: string | null;
}

/**
 * Everything the worker learned about one video.
 *
 * The metadata half is optional: it comes from a probe of the source file, and a
 * container that carries no bitrate is still a perfectly processed video.
 */
export interface ProcessingResult {
  zipKey: string;
  frameCount: number;
  durationMs: number;
  sizeBytes: number;
  codec?: string | null;
  width?: number | null;
  height?: number | null;
  frameRate?: number | null;
  bitrateBps?: number | null;
  /** Storage key of the first extracted frame, used as the poster in the library. */
  thumbnailKey?: string | null;
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
  private _codec: string | null;
  private _width: number | null;
  private _height: number | null;
  private _frameRate: number | null;
  private _bitrateBps: number | null;
  private _title: string | null;
  private _thumbnailKey: string | null;
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
    this._codec = props.codec ?? null;
    this._width = props.width ?? null;
    this._height = props.height ?? null;
    this._frameRate = props.frameRate ?? null;
    this._bitrateBps = props.bitrateBps ?? null;
    this._title = props.title ?? null;
    this._thumbnailKey = props.thumbnailKey ?? null;
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
  get codec(): string | null {
    return this._codec;
  }
  get width(): number | null {
    return this._width;
  }
  get height(): number | null {
    return this._height;
  }
  get frameRate(): number | null {
    return this._frameRate;
  }
  get bitrateBps(): number | null {
    return this._bitrateBps;
  }
  get title(): string | null {
    return this._title;
  }
  get thumbnailKey(): string | null {
    return this._thumbnailKey;
  }
  /**
   * What every screen shows. The file name is the fallback rather than the source
   * of truth, so a renamed video still downloads under its real file name.
   */
  get displayName(): string {
    return this._title ?? this.originalName;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Naming is not a state transition — a video can be renamed while it is queued,
   * running or finished, and doing so must never disturb the status machine.
   */
  rename(title: VideoTitle | null): void {
    this._title = title?.value ?? null;
    this._updatedAt = new Date();
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
    this._codec = result.codec ?? null;
    this._width = result.width ?? null;
    this._height = result.height ?? null;
    this._frameRate = result.frameRate ?? null;
    this._bitrateBps = result.bitrateBps ?? null;
    this._thumbnailKey = result.thumbnailKey ?? null;
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
