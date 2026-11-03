"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postService = exports.PostService = void 0;
const promises_1 = require("node:fs/promises");
const domain_exception_js_1 = require("../../common/exception/domain.exception.js");
const post_repository_js_1 = require("../../common/repository/post.repository.js");
const user_repository_js_1 = require("../../common/repository/user.repository.js");
class PostService {
    userRepository;
    postRepository;
    constructor() {
        this.userRepository = new user_repository_js_1.UserRepository();
        this.postRepository = new post_repository_js_1.PostRepository();
    }
    getPosts() {
        const posts = this.postRepository.paginate({
            options: {
                populate: [
                    {
                        path: "userId",
                        select: "_id firstName lastName userName image",
                    },
                ],
            },
        });
        if (!posts) {
            throw new domain_exception_js_1.NotFoundException("No posts found");
        }
        return posts;
    }
    getUserPosts(userId) {
        const posts = this.postRepository.paginate({
            filter: { userId },
            options: {
                populate: [
                    {
                        path: "userId",
                        select: "_id firstName lastName userName image",
                    },
                ],
            },
        });
        if (!posts) {
            throw new domain_exception_js_1.NotFoundException("No posts found for this user");
        }
        return posts;
    }
    async getSinglePost(postId) {
        const post = await this.postRepository.findOne({
            filter: { _id: postId },
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
        if (!post) {
            throw new domain_exception_js_1.NotFoundException("Post not found");
        }
        return post;
    }
    async createPost({ content }, files, user) {
        const post = await this.postRepository.createOne({
            data: {
                userId: user._id,
                content,
                images: files.map((ele) => ele.path),
            },
        });
        return post;
    }
    async updatePost({ content }, files, user, postId) {
        const existingPost = await this.postRepository.findOne({
            filter: { userId: user._id, _id: postId },
        });
        if (!existingPost) {
            throw new domain_exception_js_1.NotFoundException("Post not found");
        }
        if (files?.length > 0) {
            for (const oldImagePath of existingPost.images) {
                try {
                    await (0, promises_1.unlink)(oldImagePath);
                }
                catch (err) {
                    console.error(`Failed to delete old image: ${oldImagePath}`, err);
                }
            }
        }
        const post = await this.postRepository.updateOne({
            filter: { userId: user._id, _id: postId },
            data: {
                content: content ?? existingPost.content,
                images: files?.length > 0 ? files.map((ele) => ele.path) : existingPost.images,
            },
        });
        if (post.modifiedCount === 0) {
            throw new domain_exception_js_1.NotFoundException("Post not found or no changes made");
        }
        return post;
    }
    async deletePost(user, postId) {
        const post = await this.postRepository.deleteOne({
            filter: { userId: user._id, _id: postId },
        });
        if (post.deletedCount === 0) {
            throw new domain_exception_js_1.NotFoundException("Post not found or no changes made");
        }
        return post;
    }
}
exports.PostService = PostService;
exports.postService = new PostService();
