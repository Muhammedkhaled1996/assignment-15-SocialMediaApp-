import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authentication } from "../../middleware/authentication.middleware.js";
import UserService from "./users.services";
import { responceFormatter } from "../../middleware/responce.middleware.js";
import { IFollowItem, IUser } from "../../common/interface/user.interface.js";
import { IResponse } from "../../common/interface/responce.interface.js";
import { uploadMiddleware } from "../../middleware/multer.middleware.js";
import { fileValidation, localFileUpload } from "../../common/utils/multer/local.multer.js";
import { HUser } from "../../DB/module/user.model.js";
import { UserRepository } from "../../common/repository/user.repository.js";
import { IPagination } from "../../common/interface/pagination.interface.js";
import { validation } from "../../middleware/validation.middleware.js";
import * as validator from "./user.validation.js";

const router = Router({ caseSensitive: true, strict: true });

// get profile
router.get(
  "/",
  authentication(),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<IUser>> => {
    const data = await UserService.Profile(req.user);
    return { data };
  }),
);

// update profile
router.patch(
  "/",
  authentication(),
  validation(validator.update),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<IUser>> => {
    const data = await UserService.update(req.user, req.validate.body);
    return { data };
  }),
);

// upload profile image
router.patch(
  "/profile-image",
  authentication(),
  uploadMiddleware({
    isRequired: false,
    multerMiddleware: localFileUpload({ maxFileSize: 5 }).array("image"),
    customPath: "user",
    validation: fileValidation.image,
  }),
  responceFormatter(async (req: Request, res: Response): Promise<IResponse<HUser>> => {
    const uploadedFile = Array.isArray(req.files) ? req.files[0] : req.file;
    const imagePath = (uploadedFile as any)?.finalPath || uploadedFile?.path;

    if (!imagePath) {
      throw new Error("No image was uploaded or path is missing");
    }

    const userRepository = new UserRepository();

    const updatedUser = await userRepository.findByIdAndUpdate({
      id: req.user._id as any,
      data: { image: imagePath },
    });

    return { data: updatedUser as HUser };
  }),
);

// follow user
router.post(
  "/follow/:id",
  authentication(),
  validation(validator.followUser),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await UserService.followUser(req.user._id!.toString(), req.validate.params);
  }),
);

// unfollow user
router.post(
  "/unfollow/:id",
  authentication(),
  validation(validator.followUser),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await UserService.unFollowUser(req.user._id!.toString(), req.validate.params);
  }),
);

// get pending follow request
router.get(
  "/get-pending-follow-requests",
  authentication(),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<IFollowItem[]>> => {
    const data = await UserService.getPendingFollowRequests(req.user._id!.toString());
    return { data };
  }),
);

// accept follow request
router.post(
  "/accept-follow-request/:id",
  authentication(),
  validation(validator.followUser),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await UserService.acceptFollowRequest(req.user._id!.toString(), req.validate.params);
  }),
);

// reject follow request
router.post(
  "/reject-follow-request/:id",
  authentication(),
  validation(validator.followUser),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await UserService.rejectFollowRequest(req.user._id!.toString(), req.validate.params);
  }),
);

// toggle private
router.post(
  "/toggle-private",
  authentication(),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await UserService.togglePrivate(req.user._id!.toString());
  }),
);

// search user
router.get(
  "/search",
  authentication(),
  validation(validator.search),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<IPagination<IUser>>> => {
    const data = await UserService.searchUser(req.validate.query, req.user._id!.toString());
    return { data };
  }),
);

// suggestions
router.get(
  "/suggestions",
  authentication(),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<IPagination<IUser>>> => {
    const data = await UserService.suggestions(req.user._id!.toString());
    return { data };
  }),
);

export default router;
