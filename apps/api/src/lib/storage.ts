import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "fs/promises";
import path from "path";

export type StoredObject = { body: Buffer; contentType: string };

function localRoot() {
  const configured = process.env.STORAGE_LOCAL_DIR || "uploads";
  return path.resolve(process.cwd(), configured);
}

function safeKey(key: string) {
  const normalized = path.posix.normalize(key.replace(/\\/g, "/")).replace(/^(\.\.\/)+/, "");
  if (!normalized || normalized === "." || normalized.startsWith("/") || normalized.includes("..")) {
    throw new Error("Invalid storage key");
  }
  return normalized;
}

function readEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

function storageEndpoint() {
  const explicit = readEnv("R2_ENDPOINT", "S3_ENDPOINT");
  if (explicit) return explicit.replace(/\/$/, "");
  const account = readEnv("R2_ACCOUNT_ID");
  if (account) return `https://${account}.r2.cloudflarestorage.com`;
  const published = readEnv("R2_PUBLIC_URL");
  if (published.includes("r2.cloudflarestorage.com")) return published.replace(/\/$/, "");
  return undefined;
}

function usingR2() {
  return storageEndpoint()?.includes("r2.cloudflarestorage.com") || Boolean(readEnv("R2_ACCESS_KEY_ID"));
}

function bucketName() {
  const name = readEnv("R2_BUCKET_NAME", "R2_BUCKET", "S3_BUCKET");
  if (!name) throw new Error("Object storage bucket is not configured");
  return name;
}

function s3() {
  const endpoint = storageEndpoint();
  const r2 = usingR2();
  return new S3Client({
    region: readEnv("R2_REGION") || (r2 ? "auto" : readEnv("S3_REGION") || "us-east-1"),
    endpoint,
    forcePathStyle: r2 ? process.env.R2_FORCE_PATH_STYLE !== "false" : process.env.S3_FORCE_PATH_STYLE !== "false",
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: readEnv("R2_ACCESS_KEY_ID", "S3_ACCESS_KEY"),
      secretAccessKey: readEnv("R2_SECRET_ACCESS_KEY", "S3_SECRET_KEY"),
    },
  });
}

function useS3() {
  const driver = (process.env.STORAGE_DRIVER || "local").toLowerCase();
  return driver === "s3" || driver === "r2";
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  const objectKey = safeKey(key);
  if (useS3()) {
    await s3().send(
      new PutObjectCommand({
        Bucket: bucketName(),
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
      const result = await s3().send(new GetObjectCommand({ Bucket: bucketName(), Key: objectKey }));
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
    await s3().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: objectKey }));
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
  if (ext === ".gif") return "image/gif";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}
