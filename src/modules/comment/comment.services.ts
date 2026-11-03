import { unlink } from "node:fs/promises";
import { NotFoundException } from "../../common/exception/domain.exception.js";
import { IPost } from "../../common/interface/post.interface.js";
import { PostRepository } from "../../common/repository/post.repository.js";
import { UserRepository } from "../../common/repository/user.repository.js";
import { IPagination } from "../../common/interface/pagination.interface.js";
import { IResponseDelete, IResponseUpdate } from "../../common/interface/responce.interface.js";
import { CommentRepository } from "../../common/repository/comment.repository.js";
import { IComment } from "../../common/interface/comment.interface.js";
import { IUser } from "../../common/interface/user.interface.js";

export class CommentService {
  private userRepository: UserRepository;
  private postRepository: PostRepository;
  private commentRepository: CommentRepository;
  constructor() {
    this.userRepository = new UserRepository();
    this.postRepository = new PostRepository();
    this.commentRepository = new CommentRepository();
  }

  // get post comments
  async getPostComments(postId: string): Promise<IPagination<IComment>> {
    const comments = await this.commentRepository.paginate({
      filter: { postId, deletedAt: { $exists: false } },
      options: {
        populate: [
          {
            path: "userId",
            select: "_id firstName lastName userName image",
          },
        ],
        lean: true,
      },
    });
    if (!comments) {
      throw new NotFoundException("No comments found for this post");
    }
    return comments;
  }

  // get single comment
  async getSingleComment(commentId: string): Promise<IComment> {
    const comment = await this.commentRepository.findOne({
      filter: { _id: commentId, deletedAt: { $exists: false } },
      options: {
        populate: [
          {
            path: "userId",
            select: "_id firstName lastName userName image",
          },
        ],
        lean: true,
      },
    });
    if (!comment) {
      throw new NotFoundException("No comments found for this post");
    }
    return comment;
  }

  // create comment
  async createComment(
    { content }: { content: string },
    postId: string,
    files: Express.Multer.File[],
    user: IUser,
  ): Promise<IComment> {
    const comment = await this.commentRepository.createOne({
      data: {
        userId: user._id,
        postId,
        content,
        images: files.map((ele) => ele.path),
      },
    });

    await this.postRepository.updateOne({
      filter: { _id: postId, deletedAt: { $exists: false } },
      data: {
        $push: { comments: comment._id },
      },
    });

    return comment;
  }

  // create comment
  async updateComment(
    { content }: { content: string },
    files: Express.Multer.File[],
    user: IUser,
    commentId: string,
  ): Promise<IResponseUpdate> {
    const existingComment = await this.commentRepository.findById({
      id: commentId,
    });

    if (!existingComment) {
      throw new NotFoundException("Comment not found");
    }

    if (files?.length > 0) {
      for (const oldImagePath of existingComment.images || []) {
        try {
          await unlink(oldImagePath);
        } catch (err) {
          console.error(`Failed to delete old image: ${oldImagePath}`, err);
        }
      }
    }

    const comment = await this.commentRepository.updateOne({
      filter: { _id: commentId, userId: user._id!.toString() },
      data: {
        content,
        images: files?.length > 0 ? files.map((ele) => ele.path) : existingComment.images,
      },
    });

    return comment as unknown as IResponseUpdate;
  }

  // delete comment
  async deleteComment(commentId: string, user: IUser): Promise<IResponseUpdate> {
    const existingComment = await this.commentRepository.findOne({
      filter: { _id: commentId, userId: user._id!.toString(), deletedAt: { $exists: false } },
    });

    if (!existingComment) {
      throw new NotFoundException("Comment not found");
    }

    const comment = await this.commentRepository.updateOne({
      filter: { _id: commentId, userId: user._id!.toString(), deletedAt: { $exists: false } },
      data: { deletedAt: new Date() },
    });

    if (comment.modifiedCount > 0) {
      await this.postRepository.updateOne({
        filter: { _id: existingComment.postId, deletedAt: { $exists: false } },
        data: {
          $pull: { comments: existingComment._id },
        },
      });
    }

    return comment as unknown as IResponseUpdate;
  }
}

export const commentService = new CommentService();
