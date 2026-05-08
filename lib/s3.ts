import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getEnvTrim(name: string): string | undefined {
  const v = process.env[name];
  const t = v?.trim();
  return t ? t : undefined;
}

function getBucketAndRegion() {
  const bucket = getEnvTrim("AWS_S3_BUCKET");
  const region = getEnvTrim("AWS_REGION");
  if (!bucket || !region) {
    throw new Error("AWS_S3_BUCKET y AWS_REGION deben estar configuradas en las variables de entorno");
  }
  return { bucket, region };
}

function getS3Client(region: string) {
  const accessKeyId = getEnvTrim("AWS_ACCESS_KEY_ID");
  const secretAccessKey = getEnvTrim("AWS_SECRET_ACCESS_KEY");
  return new S3Client({
    region: region || "us-east-1",
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  });
}

export async function uploadToS3(key: string, body: Buffer, contentType: string) {
  const { bucket, region } = getBucketAndRegion();
  const s3Client = getS3Client(region);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ServerSideEncryption: "AES256",
  });

  await s3Client.send(command);

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export function getPublicUrl(key: string) {
  const { bucket, region } = getBucketAndRegion();
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export async function getPresignedUploadUrl(key: string, _contentType: string, expiresInSeconds = 900) {
  const { bucket, region } = getBucketAndRegion();
  const s3Client = getS3Client(region);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ServerSideEncryption: "AES256",
  });

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

export async function deleteFromS3(key: string) {
  const { bucket, region } = getBucketAndRegion();
  const s3Client = getS3Client(region);

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await s3Client.send(command);
}
