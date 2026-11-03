import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authentication, bearerAuth } from "../../middleware/authentication.middleware";
import { postService } from "./posts.services";
import { responceFormatter } from "../../middleware/responce.middleware";
import { IResponse, IResponseDelete, IResponseUpdate } from "../../common/interface/responce.interface";
import { uploadMiddleware } from "../../middleware/multer.middleware";
import { IPagination } from "../../common/interface/pagination.interface";
import { validation } from "../../middleware/validation.middleware";
import * as validators from "./posts.validation";
import { IPost } from "../../common/interface/post.interface";
import { fileValidation, localFileUpload } from "../../common/utils/multer";
import { StorageApproach, TokenEnum } from "../../common/enum";

const router = Router({ caseSensitive: true, strict: true });

// get posts
router.get(
  "/",
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<IPagination<IPost>>> => {
    const data = await postService.getPosts();
    return { data };
  }),
);

// get login userposts
router.get(
  "/login-user-posts",
  authentication(),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<IPagination<IPost>>> => {
    const data = await postService.getUserPosts(req.user._id as unknown as string);
    return { data };
  }),
);

// get post by id
router.get(
  "/get-user-post/:postId",
  authentication(),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<IPost>> => {
    const data = await postService.getSinglePost(req.params.postId as string);
    return { data };
  }),
);

// create post
router.post(
  "/",
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.headers["authorization"]) {
      await bearerAuth({ req });
    }
    next();
  },
  uploadMiddleware({
    multerMiddleware: localFileUpload({ maxFileSize: 5, storageApproach: StorageApproach.DISK }).array("images"),
    validation: fileValidation.image,
    customPath: "posts",
    isRequired: false,
  }),
  validation(validators.createPost),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<IPost>> => {
    const data = await postService.createPost(req.body, req.files as Express.Multer.File[], req.user as any);
    return { data, status: 201 };
  }),
);

// update post
router.patch(
  "/:postId",
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.headers["authorization"]) {
      await bearerAuth({ req });
    }
    next();
  },
  uploadMiddleware({
    multerMiddleware: localFileUpload({ maxFileSize: 5, storageApproach: StorageApproach.DISK }).array("images"),
    validation: fileValidation.image,
    customPath: "posts",
    isRequired: false,
  }),
  validation(validators.createPost),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponseUpdate> => {
    const data = await postService.updatePost(
      req.body,
      req.files as Express.Multer.File[],
      req.user as any,
      req.params.postId as string,
    );
    return { data } as unknown as IResponseUpdate;
  }),
);

// delete post
router.delete(
  "/:postId",
  authentication(),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponseUpdate> => {
    const data = await postService.deletePost(req.user, req.params.postId as string);
    return { data } as unknown as IResponseUpdate;
  }),
);

// share post
router.patch(
  "/share/:postId",
  authentication(),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponseUpdate> => {
    const data = await postService.sharePost(req.user, req.params.postId as string);
    return { data } as unknown as IResponseUpdate;
  }),
);

export default router;
