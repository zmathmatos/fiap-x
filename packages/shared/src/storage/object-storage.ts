import { Readable, Transform, type TransformCallback } from 'node:stream';
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

export interface StorageConfig {
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

export interface ObjectMetadata {
  sizeBytes: number;
  contentType?: string;
}

export interface ObjectStorage {
  ensureBuckets(buckets: string[]): Promise<void>;
  putStream(
    bucket: string,
    key: string,
    body: Readable,
    contentType?: string,
  ): Promise<{ sizeBytes: number }>;
  getStream(bucket: string, key: string): Promise<Readable>;
  head(bucket: string, key: string): Promise<ObjectMetadata>;
  remove(bucket: string, key: string): Promise<void>;
  isHealthy(bucket: string): Promise<boolean>;
}

/** Counts bytes as they flow through, so an upload can report its own size. */
class ByteCounter extends Transform {
  bytes = 0;

  override _transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback): void {
    this.bytes += chunk.length;
    done(null, chunk);
  }
}

function isNotFound(error: unknown): boolean {
  const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  const name = (error as { name?: string })?.name;
  return status === 404 || name === 'NotFound' || name === 'NoSuchBucket';
}

/**
 * S3-compatible storage. Points at MinIO in development and at S3 in production —
 * only the endpoint and credentials change, never the code.
 */
export function createObjectStorage(config: StorageConfig): ObjectStorage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // MinIO serves buckets as a path segment rather than a subdomain.
    forcePathStyle: config.forcePathStyle ?? false,
  });

  return {
    async ensureBuckets(buckets: string[]): Promise<void> {
      for (const bucket of buckets) {
        try {
          await client.send(new HeadBucketCommand({ Bucket: bucket }));
        } catch (error) {
          if (!isNotFound(error)) throw error;
          await client.send(new CreateBucketCommand({ Bucket: bucket }));
        }
      }
    },

    async putStream(bucket, key, body, contentType): Promise<{ sizeBytes: number }> {
      const counter = new ByteCounter();

      // lib-storage handles multipart on its own, so a 500 MB upload never has to
      // be held in memory or spilled to disk first.
      const upload = new Upload({
        client,
        params: {
          Bucket: bucket,
          Key: key,
          Body: body.pipe(counter),
          ContentType: contentType,
        },
        queueSize: 4,
        partSize: 8 * 1024 * 1024,
      });

      await upload.done();
      return { sizeBytes: counter.bytes };
    },

    async getStream(bucket, key): Promise<Readable> {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!response.Body) {
        throw new Error(`Object ${bucket}/${key} has no body`);
      }
      return response.Body as Readable;
    },

    async head(bucket, key): Promise<ObjectMetadata> {
      const response = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return {
        sizeBytes: response.ContentLength ?? 0,
        contentType: response.ContentType,
      };
    },

    async remove(bucket, key): Promise<void> {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },

    async isHealthy(bucket): Promise<boolean> {
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        return true;
      } catch {
        return false;
      }
    },
  };
}
