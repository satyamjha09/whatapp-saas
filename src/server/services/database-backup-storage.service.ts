import fs from "fs";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

function getRemoteStorageConfig() {
  const bucket = process.env.S3_BACKUP_BUCKET;
  const region = process.env.S3_BACKUP_REGION ?? "auto";
  const endpoint = process.env.S3_BACKUP_ENDPOINT;
  const accessKeyId = process.env.S3_BACKUP_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_BACKUP_SECRET_ACCESS_KEY;
  const prefix = process.env.S3_BACKUP_PREFIX ?? "tallykonnect/postgres";

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 backup storage is not configured");
  }

  return {
    bucket,
    region,
    endpoint,
    accessKeyId,
    secretAccessKey,
    prefix: prefix.replace(/^\/+|\/+$/g, ""),
  };
}

export function isRemoteBackupStorageEnabled() {
  return process.env.DATABASE_BACKUP_REMOTE_STORAGE_ENABLED === "true";
}

function createBackupS3Client() {
  const config = getRemoteStorageConfig();

  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint || undefined,
    forcePathStyle: Boolean(config.endpoint),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return {
    client,
    config,
  };
}

export async function uploadDatabaseBackupToRemoteStorage({
  filePath,
  fileName,
  checksumSha256,
}: {
  filePath: string;
  fileName: string;
  checksumSha256: string;
}) {
  const { client, config } = createBackupS3Client();

  const remoteKey = `${config.prefix}/${fileName}`;

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: remoteKey,
      Body: fs.createReadStream(filePath),
      ContentType: "application/octet-stream",
      Metadata: {
        checksumsha256: checksumSha256,
        service: "tallykonnect",
      },
    }),
  );

  return {
    bucket: config.bucket,
    key: remoteKey,
  };
}

export async function getRemoteDatabaseBackupObjectMetadata({
  bucket,
  key,
}: {
  bucket: string;
  key: string;
}) {
  const { client } = createBackupS3Client();

  const object = await client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  return {
    contentLength: object.ContentLength ?? null,
    checksumSha256:
      object.Metadata?.checksumsha256 ??
      object.Metadata?.checksumSha256 ??
      null,
    lastModified: object.LastModified ?? null,
  };
}
