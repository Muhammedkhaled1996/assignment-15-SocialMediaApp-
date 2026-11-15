import { Router, Request } from "express";
import {
  authentication,
  authorizeRoles,
  responceFormatter,
  uploadMiddleware,
} from "../../middleware";
import { fileValidation, localFileUpload } from "../../common/utils/multer";
import { ALL_USER_ROLES, AttachmentEnum, StorageApproach, UserRole } from "../../common/enum";
import { FILE_STORAGE_PROVIDER } from "../../config";
import { settingsService } from "./settings.service";

const router = Router({ caseSensitive: true, strict: true });

router.get(
  "/company",
  authentication(),
  authorizeRoles(...ALL_USER_ROLES),
  responceFormatter(async (_req: Request) => {
    const data = await settingsService.getCompanyProfile();
    return { data };
  }),
);

router.patch(
  "/company",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  responceFormatter(async (req: Request) => {
    const data = await settingsService.updateCompanyProfile(req.body, req);
    return { data };
  }),
);

router.get(
  "/",
  authentication(),
  authorizeRoles(...ALL_USER_ROLES),
  responceFormatter(async (req: Request) => {
    const data = await settingsService.listSettings(req.query);
    return { data };
  }),
);

router.put(
  "/:key",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  responceFormatter(async (req: Request) => {
    const data = await settingsService.upsertSetting(req.params.key as string, req.body, req);
    return { data };
  }),
);

router.post(
  "/attachments",
  authentication(),
  uploadMiddleware({
    isRequired: true,
    multerMiddleware: localFileUpload({ maxFileSize: 10, storageApproach: StorageApproach.MEMORY }).single("file"),
    customPath: "attachments",
    validation: [...fileValidation.image, ...fileValidation.files],
    storageApproach: FILE_STORAGE_PROVIDER === "S3" ? AttachmentEnum.cloud : AttachmentEnum.local,
  }),
  responceFormatter(async (req: Request) => {
    const file = req.file as Express.Multer.File;
    const data = await settingsService.createAttachment(file, req);
    return { status: 201, data };
  }),
);

router.get(
  "/attachments",
  authentication(),
  responceFormatter(async (req: Request) => {
    const data = await settingsService.listAttachments(req);
    return { data };
  }),
);

export const settingsController = router;
export default router;
