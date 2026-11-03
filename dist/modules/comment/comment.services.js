"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentService = exports.CommentService = void 0;
const promises_1 = require("node:fs/promises");
const domain_exception_js_1 = require("../../common/exception/domain.exception.js");
const post_repository_js_1 = require("../../common/repository/post.repository.js");
const user_repository_js_1 = require("../../common/repository/user.repository.js");
const comment_repository_js_1 = require("../../common/repository/comment.repository.js");
class CommentService {
    userRepository;
    postRepository;
    commentRepository;
    constructor() {
        this.userRepository = new user_repository_js_1.UserRepository();
        this.postRepository = new post_repository_js_1.PostRepository();
        this.commentRepository = new comment_repository_js_1.CommentRepository();
    }
    async getPostComments(postId) {
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
            throw new domain_exception_js_1.NotFoundException("No comments found for this post");
        }
        return comments;
    }
    async getSingleComment(commentId) {
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
            throw new domain_exception_js_1.NotFoundException("No comments found for this post");
        }
        return comment;
    }
    async createComment({ content }, postId, files, user) {
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
    async updateComment({ content }, files, user, commentId) {
        const existingComment = await this.commentRepository.findById({
            id: commentId,
        });
        if (!existingComment) {
            throw new domain_exception_js_1.NotFoundException("Comment not found");
        }
        if (files?.length > 0) {
            for (const oldImagePath of existingComment.images || []) {
                try {
                    await (0, promises_1.unlink)(oldImagePath);
                }
                catch (err) {
                    console.error(`Failed to delete old image: ${oldImagePath}`, err);
                }
            }
        }
        const comment = await this.commentRepository.updateOne({
            filter: { _id: commentId, userId: user._id.toString() },
            data: {
                content,
                images: files?.length > 0 ? files.map((ele) => ele.path) : existingComment.images,
            },
        });
        return comment;
    }
    async deleteComment(commentId, user) {
        const existingComment = await this.commentRepository.findOne({
            filter: { _id: commentId, userId: user._id.toString(), deletedAt: { $exists: false } },
        });
        if (!existingComment) {
            throw new domain_exception_js_1.NotFoundException("Comment not found");
        }
        const comment = await this.commentRepository.updateOne({
            filter: { _id: commentId, userId: user._id.toString(), deletedAt: { $exists: false } },
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
        return comment;
    }
}
exports.CommentService = CommentService;
exports.commentService = new CommentService();
