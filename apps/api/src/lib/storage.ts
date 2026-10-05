import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "fs/promises";
import path from "path";

export type StoredObject = { body: Buffer; contentType: string };

function localRoot() {
  const configured = process.env.STORAGE_LOCAL_DIR || "uploads";
  return path.resolve(process.cwd(), configured);
}

function safeKey(key: string) {
  const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  if (normalized.includes("..")) {
    throw new Error("Invalid storage key");
  }
  return normalized;
}

function s3() {
  return new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || "",
      secretAccessKey: process.env.S3_SECRET_KEY || "",
    },
  });
}

function useS3() {
  return process.env.STORAGE_DRIVER === "s3";
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  const objectKey = safeKey(key);
  if (useS3()) {
    await s3().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
      }),
    );
    return;
  }
  const full = path.join(localRoot(), objectKey);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
}

export async function getObject(key: string): Promise<StoredObject | null> {
  const objectKey = safeKey(key);
  if (useS3()) {
    try {
      const result = await s3().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: objectKey }));
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) return null;
      return { body: Buffer.from(bytes), contentType: result.ContentType || "application/octet-stream" };
    } catch {
      return null;
    }
  }
  try {
    const body = await fs.readFile(path.join(localRoot(), objectKey));
    return { body, contentType: contentTypeFor(objectKey) };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string) {
  const objectKey = safeKey(key);
  if (useS3()) {
    await s3().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: objectKey }));
    return;
  }
  await fs.rm(path.join(localRoot(), objectKey), { force: true });
}

function contentTypeFor(key: string) {
  const ext = path.extname(key).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}
