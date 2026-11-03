import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authentication } from "../../middleware/authentication.middleware";
import { responceFormatter } from "../../middleware/responce.middleware";
import { IResponse, IResponseDelete, IResponseUpdate } from "../../common/interface/responce.interface";
import { uploadMiddleware } from "../../middleware/multer.middleware";
import { IPagination } from "../../common/interface/pagination.interface";
import { validation } from "../../middleware/validation.middleware";
import { fileValidation, localFileUpload } from "../../common/utils/multer";
import { StorageApproach } from "../../common/enum";
import { commentService } from "./comment.services";
import { IComment } from "../../common/interface";
import * as validators from "./comment.validation";
import { IUser } from "../../common/interface/user.interface";

const router = Router({ caseSensitive: true, strict: true });

// get single Comment
router.get(
  "/:commentId",
  authentication(),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<IComment>> => {
    const data = await commentService.getSingleComment(req.params.commentId as string);
    return { data };
  }),
);

// get post Comments
router.get(
  "/post-comments/:postId",
  authentication(),
  responceFormatter(
    async (req: Request, res: Response, next: NextFunction): Promise<IResponse<IPagination<IComment>>> => {
      const data = await commentService.getPostComments(req.params.postId as string);
      return { data };
    },
  ),
);

// create comment
router.post(
  "/:postId",
  authentication(),
  uploadMiddleware({
    multerMiddleware: localFileUpload({ maxFileSize: 5, storageApproach: StorageApproach.DISK }).array("images"),
    validation: fileValidation.image,
    customPath: "comments",
    isRequired: false,
  }),
  validation(validators.createComment),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<IComment>> => {
    const data = await commentService.createComment(
      req.body,
      req.params.postId as string,
      req.files as Express.Multer.File[],
      req.user as IUser,
    );
    return { data, status: 201 };
  }),
);

// update comment
router.patch(
  "/:commentId",
  authentication(),
  uploadMiddleware({
    multerMiddleware: localFileUpload({ maxFileSize: 5, storageApproach: StorageApproach.DISK }).array("images"),
    validation: fileValidation.image,
    customPath: "comments",
    isRequired: false,
  }),
  validation(validators.updateComment),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponseUpdate> => {
    const data = await commentService.updateComment(
      req.body,
      req.files as Express.Multer.File[],
      req.user as IUser,
      req.params.commentId as string,
    );
    return { data } as unknown as IResponseUpdate;
  }),
);

// delete comment
router.delete(
  "/:commentId",
  authentication(),
  validation(validators.deleteComment),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponseDelete> => {
    const data = await commentService.deleteComment(req.params.commentId as string , req.user as IUser);
    return { data } as unknown as IResponseDelete;
  }),
);

export default router;
