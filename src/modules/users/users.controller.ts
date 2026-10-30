import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authentication } from "../../middleware/authentication.middleware.js";
import UserService from "./users.services";
import { responceFormatter } from "../../middleware/responce.middleware.js";
import { IUser } from "../../common/interface/user.interface.js";
import { IResponse } from "../../common/interface/responce.interface.js";
import { uploadMiddleware } from "../../middleware/multer.middleware.js";
import { fileValidation, localFileUpload } from "../../common/utils/multer/local.multer.js";
import { HUser, UserModel } from "../../DB/module/user.model.js";
import { UserRepository } from "../../common/repository/user.repository.js";

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

  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<IUser>> => {
    const data = await UserService.update(req.user, req.body);
    return { data };
  }),
);

// // upload profile image
// router.patch(
//   "/profile-image",
//   authentication(),
//   uploadMiddleware({
//     isRequired: false,
//     multerMiddleware: localFileUpload({ maxFileSize: 5 }).array("image"),
//     customPath: "user",
//     validation: fileValidation.image,
//   }),

//   responceFormatter(async (req: Request, res: Response): Promise<IResponse<HUser>> => {
//     const user = req.user as HUser;
//     user.image = req.file?.finalPath || req.files?.[0].finalPath;

//     await user.save();
//     return { data: user };
//   }),
// );

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

export default router;
