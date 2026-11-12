import { ObjectCannedACL, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { APPLICATIION_NAME, AWS_ACCESS_KEY_ID, AWS_BUCKET_NAME, AWS_REGION, AWS_SECRET_ACCESS_KEY } from "../../config";
import { randomUUID } from "node:crypto";
import { BadRequestException } from "../exception";
import path from "node:path"; // <-- يفضل استيرادها لأخذ الامتداد فقط

export class CloudService {
  private cloudClient: S3Client;

  constructor() {
    this.cloudClient = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  async uploadAsset({
    Bucket = AWS_BUCKET_NAME,
    // ACL = ObjectCannedACL.private, // <-- 1. جعل الملف عاماً إذا أردت عرضه مباشرة بالرابط
    file,
    folder = "general",
  }: {
    Bucket?: string;
    // ACL?: ObjectCannedACL;
    file: Express.Multer.File;
    folder?: string;
  }): Promise<string> {
    // 2. أخذ امتداد الملف فقط بدلاً من الاسم الأصلي لتجنب المسافات والرموز الغريبة في الرابط
    const fileExtension = path.extname(file.originalname);
    const key = `${APPLICATIION_NAME}/${folder}/${randomUUID()}${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket, // <-- 3. استخدام المتغير المُمرر للدالة
      Key: key,
      // ACL,
      Body: file.buffer,
      ContentType: file.mimetype, // <-- الحل الأساسي لعرض الصورة في المتصفح بدل تحميلها
    });

    await this.cloudClient.send(command);

    if (!command.input.Key) {
      throw new BadRequestException("Fail to upload asset");
    }

    return command.input.Key;
  }
}

export const cloudService = new CloudService();
