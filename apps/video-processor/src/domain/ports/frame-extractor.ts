/** What one probe of the source file tells us. Every field but the duration is optional. */
export interface VideoMetadata {
  durationMs: number;
  codec: string | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  bitrateBps: number | null;
}

export interface ExtractFramesInput {
  inputPath: string;
  outputDir: string;
  frameIntervalSeconds: number;
  /** Called with a whole percent, at most once per percent, while ffmpeg runs. */
  onProgress?: (percent: number) => void;
}

export interface ExtractFramesResult {
  frameCount: number;
  metadata: VideoMetadata;
}

export interface FrameExtractor {
  extract(input: ExtractFramesInput): Promise<ExtractFramesResult>;
}
