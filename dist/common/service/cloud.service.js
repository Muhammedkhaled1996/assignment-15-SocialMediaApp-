"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudService = exports.CloudService = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const config_1 = require("../../config");
const node_crypto_1 = require("node:crypto");
const exception_1 = require("../exception");
const node_path_1 = __importDefault(require("node:path"));
class CloudService {
    cloudClient;
    constructor() {
        this.cloudClient = new client_s3_1.S3Client({
            region: config_1.AWS_REGION,
            credentials: {
                accessKeyId: config_1.AWS_ACCESS_KEY_ID,
                secretAccessKey: config_1.AWS_SECRET_ACCESS_KEY,
            },
        });
    }
    async uploadAsset({ Bucket = config_1.AWS_BUCKET_NAME, file, folder = "general", }) {
        const fileExtension = node_path_1.default.extname(file.originalname);
        const key = `${config_1.APPLICATION_NAME}/${folder}/${(0, node_crypto_1.randomUUID)()}${fileExtension}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
        });
        await this.cloudClient.send(command);
        if (!command.input.Key) {
            throw new exception_1.BadRequestException("Fail to upload asset");
        }
        return command.input.Key;
    }
}
exports.CloudService = CloudService;
exports.cloudService = new CloudService();
