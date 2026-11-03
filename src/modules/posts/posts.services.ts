import { unlink } from "node:fs/promises";
import { NotFoundException } from "../../common/exception/domain.exception.js";
import { PostRepository } from "../../common/repository/post.repository.js";
import { UserRepository } from "../../common/repository/user.repository.js";
import { IPagination } from "./../../common/interface/pagination.interface";
import { IResponseUpdate } from "../../common/interface/responce.interface.js";
import { IPost } from "./../../common/interface/post.interface";
import { IUser } from "../../common/interface/user.interface.js";

export class PostService {
  private userRepository: UserRepository;
  private postRepository: PostRepository;
  constructor() {
    this.userRepository = new UserRepository();
    this.postRepository = new PostRepository();
  }

  // get posts
  getPosts(): Promise<IPagination<IPost>> {
    const posts = this.postRepository.paginate({
      filter: { deletedAt: { $exists: false } },
      options: {
        populate: [
          {
            path: "userId",
            select: "_id firstName lastName userName image",
          },
          {
            path: "comments",
            select: "_id content images createdAt",
            populate: { path: "userId", select: "_id firstName lastName userName image" },
          },
        ],
      },
    });
    if (!posts) {
      throw new NotFoundException("No posts found");
    }
    return posts;
  }

  // get login user posts
  getUserPosts(userId: string): Promise<IPagination<IPost>> {
    const posts = this.postRepository.paginate({
      filter: { userId, deletedAt: { $exists: false } },
      options: {
        populate: [
          {
            path: "userId",
            select: "_id firstName lastName userName image",
          },
          {
            path: "comments",
            select: "_id content images createdAt",
            populate: { path: "userId", select: "_id firstName lastName userName image" },
          },
        ],
      },
    });
    if (!posts) {
      throw new NotFoundException("No posts found for this user");
    }
    return posts;
  }

  // get single post
  async getSinglePost(postId: string): Promise<IPost> {
    const post = await this.postRepository.findOne({
      filter: { _id: postId, deletedAt: { $exists: false } },
      options: {
        populate: [
          {
            path: "userId",
            select: "_id firstName lastName userName image",
          },
          {
            path: "comments",
            select: "_id content images createdAt",
            populate: { path: "userId", select: "_id firstName lastName userName image" },
          },
        ],
        // lean: true,
      },
    });
    if (!post) {
      throw new NotFoundException("Post not found");
    }
    return post;
  }

  // create post
  async createPost({ content }: { content: string }, files: Express.Multer.File[], user: IUser): Promise<IPost> {
    const post = await this.postRepository.createOne({
      data: {
        userId: user._id,
        content,
        images: files.map((ele) => ele.path),
      },
    });

    return post;
  }

  // update post
  async updatePost(
    { content }: { content: string },
    files: Express.Multer.File[],
    user: any,
    postId: string,
  ): Promise<IResponseUpdate> {
    const existingPost = await this.postRepository.findOne({
      filter: { userId: user._id, _id: postId },
    });
    if (!existingPost) {
      throw new NotFoundException("Post not found");
    }

    if (files?.length > 0) {
      for (const oldImagePath of existingPost.images!) {
        try {
          await unlink(oldImagePath);
        } catch (err) {
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
      throw new NotFoundException("Post not found or no changes made");
    }
    return post as IResponseUpdate;
  }

  // update post
  async deletePost(user: IUser, postId: string): Promise<IResponseUpdate> {
    const post = await this.postRepository.updateOne({
      filter: { userId: user._id!.toString(), _id: postId, deletedAt: { $exists: false } },
      data: { deletedAt: new Date() },
    });

    if (post.modifiedCount === 0) {
      throw new NotFoundException("Post not found or no changes made");
    }

    return post as IResponseUpdate;
  }

  // like / unlike post
  async likeUnlikePost(user: IUser, postId: string): Promise<IResponseUpdate> {
    const existingPost = (await this.postRepository.findOne({
      filter: { _id: postId, deletedAt: { $exists: false } },
    })) as IPost;

    if (!existingPost) {
      throw new NotFoundException("Post not found");
    }

    const isLiked = Array.isArray(existingPost.likes) && existingPost?.likes?.includes(user._id?.toString());

    let updateData;

    if (isLiked) {
      updateData = { $pull: { likes: user._id } };
    } else {
      updateData = { $push: { likes: user._id } };
    }

    const post = await this.postRepository.updateOne({
      filter: { _id: postId, deletedAt: { $exists: false } },
      data: updateData,
    });

    if (post.modifiedCount === 0) {
      throw new NotFoundException("Post not found or no changes made");
    }

    return post as IResponseUpdate;
  }

  // share post
  async sharePost(user: IUser, postId: string): Promise<IResponseUpdate> {
    const existingPost = (await this.postRepository.findOne({
      filter: { _id: postId, deletedAt: { $exists: false } },
    })) as IPost;

    if (!existingPost) {
      throw new NotFoundException("Post not found");
    }

    const isShared = Array.isArray(existingPost.shares) && existingPost?.shares?.includes(user._id?.toString());

    let updateData;

    if (isShared) {
      throw new NotFoundException("Post already shared by this user");
    }

    const post = await this.postRepository.updateOne({
      filter: { _id: postId, deletedAt: { $exists: false } },
      data: { $push: { shares: user._id } },
    });

    if (post.modifiedCount === 0) {
      throw new NotFoundException("Post not found or no changes made");
    }

    return post as IResponseUpdate;
  }
}

export const postService = new PostService();
