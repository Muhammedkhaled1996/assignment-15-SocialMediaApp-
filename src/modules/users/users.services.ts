import { FollowStatus } from "../../common/enum/followStatus.enum.js";
import { BadRequestException, ConflictException, NotFoundException } from "../../common/exception/domain.exception.js";
import { IPagination } from "../../common/interface/pagination.interface.js";
import { IFollowItem, IUser } from "../../common/interface/user.interface.js";
import { UserRepository } from "../../common/repository/user.repository.js";
import { encryption } from "../../common/security/encryption.security.js";
import { updateDto } from "./dto/user.dto.js";

export class UserService {
  private userRepository: UserRepository;
  constructor() {
    this.userRepository = new UserRepository();
  }

  // get profile
  Profile(user: IUser) {
    return user;
  }

  // update user
  async update(user: IUser & { id?: string }, { userName, phone, gender }: updateDto["body"]) {
    const existingUser = await this.userRepository.findById({ id: user.id as string });

    if (!existingUser) {
      throw new NotFoundException("user not found");
    }

    if (userName) {
      existingUser.userName = userName;
      await existingUser.save();
    }
    if (phone) {
      existingUser.phone = await encryption(phone);
      await existingUser.save();
    }
    if (gender == 0 || gender == 1) {
      existingUser.gender = gender;
      await existingUser.save();
    }

    return existingUser;
  }

  // follow user
  async followUser(followerId: string, { id }: { id: string }) {
    if (followerId === id) {
      throw new BadRequestException("You cannot follow yourself");
    }

    const existingFollower = await this.userRepository.findById({ id: followerId });
    const existingFollowing = await this.userRepository.findById({ id: id });

    if (!existingFollower || !existingFollowing) {
      throw new NotFoundException("user not found");
    }

    const isAlreadyFollowing = existingFollower.followings?.some(
      (f) => f.id.toString() === existingFollowing._id!.toString(),
    );

    if (isAlreadyFollowing) {
      throw new ConflictException("Already following or follow request already sent");
    }

    const status = existingFollowing.isPrivate ? FollowStatus.PENDING : FollowStatus.ACCEPTED;

    existingFollower.followings = existingFollower.followings || [];
    existingFollowing.followers = existingFollowing.followers || [];

    existingFollower.followings.push({
      id: existingFollowing._id!,
      status,
      createdAt: new Date(),
    });

    existingFollowing.followers.push({
      id: existingFollower._id!,
      status,
      createdAt: new Date(),
    });

    await existingFollower.save();
    await existingFollowing.save();

    return;
  }

  // unfollow user
  async unFollowUser(followerId: string, { id }: { id: string }) {
    if (followerId === id) {
      throw new BadRequestException("You cannot unfollow yourself");
    }

    const existingFollower = await this.userRepository.findById({ id: followerId });
    const existingFollowing = await this.userRepository.findById({ id: id });

    if (!existingFollower || !existingFollowing) {
      throw new NotFoundException("user not found");
    }

    const isFollowing = existingFollower.followings?.some((f) => f.id.toString() === existingFollowing._id!.toString());

    if (!isFollowing) {
      throw new BadRequestException("You are not following this user");
    }

    existingFollower.followings = existingFollower.followings?.filter(
      (f) => f.id.toString() !== existingFollowing._id!.toString(),
    );
    existingFollowing.followers = existingFollowing.followers?.filter(
      (f) => f.id.toString() !== existingFollower._id!.toString(),
    );

    await existingFollower.save();
    await existingFollowing.save();

    return;
  }

  // get pending follow request
  async getPendingFollowRequests(userId: string): Promise<IFollowItem[]> {
    const existingUser = await this.userRepository.findById({
      id: userId,
      options: {
        populate: {
          path: "followers.id",
          select: "_id firstName lastName userName image",
        },
      },
    });

    if (!existingUser) {
      throw new NotFoundException("user not found");
    }

    const pendingFollowRequests = existingUser.followers?.filter((f) => f.status === FollowStatus.PENDING) || [];

    return pendingFollowRequests;
  }

  // accept follow request
  async acceptFollowRequest(userId: string, { id }: { id: string }) {
    if (userId === id) {
      throw new BadRequestException("Invalid operation");
    }

    const user = await this.userRepository.findById({ id: userId });
    const requester = await this.userRepository.findById({ id: id });

    if (!user || !requester) {
      throw new NotFoundException("user not found");
    }

    const hasPendingRequest = user.followers?.some(
      (f) => f.id.toString() === requester._id!.toString() && f.status === FollowStatus.PENDING,
    );

    if (!hasPendingRequest) {
      throw new NotFoundException("No pending follow request from this user");
    }

    user.followers = user.followers?.map((f) =>
      f.id.toString() === requester._id!.toString() ? { ...f, status: FollowStatus.ACCEPTED } : f,
    );
    requester.followings = requester.followings?.map((f) =>
      f.id.toString() === user._id!.toString() ? { ...f, status: FollowStatus.ACCEPTED } : f,
    );

    await user.save();
    await requester.save();

    return user;
  }

  // reject follow request
  async rejectFollowRequest(userId: string, { id }: { id: string }) {
    if (userId === id) {
      throw new BadRequestException("Invalid operation");
    }

    const user = await this.userRepository.findById({ id: userId });
    const requester = await this.userRepository.findById({ id: id });

    if (!user || !requester) {
      throw new NotFoundException("user not found");
    }

    const hasPendingRequest = user.followers?.some(
      (f) => f.id.toString() === requester._id!.toString() && f.status === FollowStatus.PENDING,
    );

    if (!hasPendingRequest) {
      throw new NotFoundException("No pending follow request from this user");
    }

    user.followers = user.followers?.filter((f) => f.id.toString() !== requester._id!.toString());
    requester.followings = requester.followings?.filter((f) => f.id.toString() !== user._id!.toString());

    await user.save();
    await requester.save();

    return;
  }

  // toggle private
  async togglePrivate(userId: string) {
    const existingUser = await this.userRepository.findById({ id: userId });

    if (!existingUser) {
      throw new NotFoundException("user not found");
    }

    existingUser.isPrivate = !existingUser.isPrivate;
    await existingUser.save();

    return;
  }

  // search user
  async searchUser(
    { search }: { search: string },
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<IPagination<IUser>> {
    console.log({ search });

    if (!search || !search.trim()) {
      throw new BadRequestException("Search keyword is required");
    }

    const trimmedSearch = search.trim();
    const escapedSearch = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameParts = trimmedSearch.split(/\s+/).filter(Boolean);

    const orConditions: any[] = [
      { firstName: { $regex: escapedSearch, $options: "i" } },
      { lastName: { $regex: escapedSearch, $options: "i" } },
      { email: { $regex: escapedSearch, $options: "i" } },
      { phone: { $regex: escapedSearch, $options: "i" } },
    ];

    if (nameParts.length >= 2) {
      const [firstNamePart, ...restParts] = nameParts;
      const first = (firstNamePart || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rest = restParts.join(" ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      orConditions.push({
        $and: [{ firstName: { $regex: first, $options: "i" } }, { lastName: { $regex: rest, $options: "i" } }],
      });
    }

    const result = await this.userRepository.paginate({
      filter: {
        $or: orConditions,
        _id: { $ne: userId },
      },
      options: {
        populate: [
          { path: "followings.id", select: "firstName lastName image" },
          { path: "followers.id", select: "firstName lastName image" },
        ],
        select: "firstName lastName email phone image isPrivate",
      },
      page,
      limit,
    });

    return result;
  }

  // suggestions
  async suggestions(userId: string): Promise<IPagination<IUser>> {
    const existingUser = await this.userRepository.paginate({
      filter: {
        _id: { $ne: userId },
        "followings.id": { $ne: userId },
        "followers.id": { $ne: userId },
      },
      options: {
        populate: [
          { path: "followings.id", select: "userName image" },
          { path: "followers.id", select: "userName image" },
        ],
        select: "firstName lastName userName image followings followers",
      },
      page: 1,
      limit: 10,
    });

    if (!existingUser.docs) {
      throw new NotFoundException("user not found");
    }

    return existingUser;
  }
}

export default new UserService();
