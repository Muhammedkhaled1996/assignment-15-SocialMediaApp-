"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const followStatus_enum_js_1 = require("../../common/enum/followStatus.enum.js");
const domain_exception_js_1 = require("../../common/exception/domain.exception.js");
const user_repository_js_1 = require("../../common/repository/user.repository.js");
const encryption_security_js_1 = require("../../common/security/encryption.security.js");
class UserService {
    userRepository;
    constructor() {
        this.userRepository = new user_repository_js_1.UserRepository();
    }
    Profile(user) {
        return user;
    }
    async update(user, { userName, phone, gender }) {
        const existingUser = await this.userRepository.findById({ id: user.id });
        if (!existingUser) {
            throw new domain_exception_js_1.NotFoundException("user not found");
        }
        if (userName) {
            existingUser.userName = userName;
            await existingUser.save();
        }
        if (phone) {
            existingUser.phone = await (0, encryption_security_js_1.encryption)(phone);
            await existingUser.save();
        }
        if (gender == 0 || gender == 1) {
            existingUser.gender = gender;
            await existingUser.save();
        }
        return existingUser;
    }
    async followUser(followerId, { id }) {
        if (followerId === id) {
            throw new domain_exception_js_1.BadRequestException("You cannot follow yourself");
        }
        const existingFollower = await this.userRepository.findById({ id: followerId });
        const existingFollowing = await this.userRepository.findById({ id: id });
        if (!existingFollower || !existingFollowing) {
            throw new domain_exception_js_1.NotFoundException("user not found");
        }
        const isAlreadyFollowing = existingFollower.followings?.some((f) => f.id.toString() === existingFollowing._id.toString());
        if (isAlreadyFollowing) {
            throw new domain_exception_js_1.ConflictException("Already following or follow request already sent");
        }
        const status = existingFollowing.isPrivate ? followStatus_enum_js_1.FollowStatus.PENDING : followStatus_enum_js_1.FollowStatus.ACCEPTED;
        existingFollower.followings = existingFollower.followings || [];
        existingFollowing.followers = existingFollowing.followers || [];
        existingFollower.followings.push({
            id: existingFollowing._id,
            status,
            createdAt: new Date(),
        });
        existingFollowing.followers.push({
            id: existingFollower._id,
            status,
            createdAt: new Date(),
        });
        await existingFollower.save();
        await existingFollowing.save();
        return;
    }
    async unFollowUser(followerId, { id }) {
        if (followerId === id) {
            throw new domain_exception_js_1.BadRequestException("You cannot unfollow yourself");
        }
        const existingFollower = await this.userRepository.findById({ id: followerId });
        const existingFollowing = await this.userRepository.findById({ id: id });
        if (!existingFollower || !existingFollowing) {
            throw new domain_exception_js_1.NotFoundException("user not found");
        }
        const isFollowing = existingFollower.followings?.some((f) => f.id.toString() === existingFollowing._id.toString());
        if (!isFollowing) {
            throw new domain_exception_js_1.BadRequestException("You are not following this user");
        }
        existingFollower.followings = existingFollower.followings?.filter((f) => f.id.toString() !== existingFollowing._id.toString());
        existingFollowing.followers = existingFollowing.followers?.filter((f) => f.id.toString() !== existingFollower._id.toString());
        await existingFollower.save();
        await existingFollowing.save();
        return;
    }
    async getPendingFollowRequests(userId) {
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
            throw new domain_exception_js_1.NotFoundException("user not found");
        }
        const pendingFollowRequests = existingUser.followers?.filter((f) => f.status === followStatus_enum_js_1.FollowStatus.PENDING) || [];
        return pendingFollowRequests;
    }
    async acceptFollowRequest(userId, { id }) {
        if (userId === id) {
            throw new domain_exception_js_1.BadRequestException("Invalid operation");
        }
        const user = await this.userRepository.findById({ id: userId });
        const requester = await this.userRepository.findById({ id: id });
        if (!user || !requester) {
            throw new domain_exception_js_1.NotFoundException("user not found");
        }
        const hasPendingRequest = user.followers?.some((f) => f.id.toString() === requester._id.toString() && f.status === followStatus_enum_js_1.FollowStatus.PENDING);
        if (!hasPendingRequest) {
            throw new domain_exception_js_1.NotFoundException("No pending follow request from this user");
        }
        user.followers = user.followers?.map((f) => f.id.toString() === requester._id.toString() ? { ...f, status: followStatus_enum_js_1.FollowStatus.ACCEPTED } : f);
        requester.followings = requester.followings?.map((f) => f.id.toString() === user._id.toString() ? { ...f, status: followStatus_enum_js_1.FollowStatus.ACCEPTED } : f);
        await user.save();
        await requester.save();
        return user;
    }
    async rejectFollowRequest(userId, { id }) {
        if (userId === id) {
            throw new domain_exception_js_1.BadRequestException("Invalid operation");
        }
        const user = await this.userRepository.findById({ id: userId });
        const requester = await this.userRepository.findById({ id: id });
        if (!user || !requester) {
            throw new domain_exception_js_1.NotFoundException("user not found");
        }
        const hasPendingRequest = user.followers?.some((f) => f.id.toString() === requester._id.toString() && f.status === followStatus_enum_js_1.FollowStatus.PENDING);
        if (!hasPendingRequest) {
            throw new domain_exception_js_1.NotFoundException("No pending follow request from this user");
        }
        user.followers = user.followers?.filter((f) => f.id.toString() !== requester._id.toString());
        requester.followings = requester.followings?.filter((f) => f.id.toString() !== user._id.toString());
        await user.save();
        await requester.save();
        return;
    }
    async togglePrivate(userId) {
        const existingUser = await this.userRepository.findById({ id: userId });
        if (!existingUser) {
            throw new domain_exception_js_1.NotFoundException("user not found");
        }
        existingUser.isPrivate = !existingUser.isPrivate;
        await existingUser.save();
        return;
    }
    async searchUser({ search }, userId, page = 1, limit = 10) {
        console.log({ search });
        if (!search || !search.trim()) {
            throw new domain_exception_js_1.BadRequestException("Search keyword is required");
        }
        const trimmedSearch = search.trim();
        const escapedSearch = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const nameParts = trimmedSearch.split(/\s+/).filter(Boolean);
        const orConditions = [
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
    async suggestions(userId) {
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
            throw new domain_exception_js_1.NotFoundException("user not found");
        }
        return existingUser;
    }
}
exports.UserService = UserService;
exports.default = new UserService();
