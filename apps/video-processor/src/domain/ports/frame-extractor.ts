export interface ExtractFramesInput {
  inputPath: string;
  outputDir: string;
  frameIntervalSeconds: number;
}

export interface ExtractFramesResult {
  frameCount: number;
  durationMs: number;
}

export interface FrameExtractor {
  extract(input: ExtractFramesInput): Promise<ExtractFramesResult>;
}
