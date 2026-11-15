"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const domain_exception_js_1 = require("../../common/exception/domain.exception.js");
const index_js_1 = require("../../common/enum/index.js");
const user_repository_js_1 = require("../../common/repository/user.repository.js");
const index_js_2 = require("../../common/security/index.js");
const index_js_3 = require("../../DB/module/index.js");
const audit_service_js_1 = require("../../common/service/audit.service.js");
class UserService {
    userRepository;
    constructor() {
        this.userRepository = new user_repository_js_1.UserRepository();
    }
    assertRoleAssignmentAuthority(actor, targetRoleNumber) {
        if (!index_js_1.ALL_USER_ROLES.includes(targetRoleNumber)) {
            throw new domain_exception_js_1.BadRequestException("Invalid roleNumber");
        }
        const actorRole = actor.roleNumber;
        if (actorRole === index_js_1.UserRole.SUPER_ADMIN) {
            return;
        }
        if (actorRole === index_js_1.UserRole.ADMIN) {
            if (targetRoleNumber === index_js_1.UserRole.SUPER_ADMIN || targetRoleNumber === index_js_1.UserRole.ADMIN) {
                throw new domain_exception_js_1.ForbiddenException("ADMIN cannot assign SUPER_ADMIN or ADMIN roles");
            }
            return;
        }
        throw new domain_exception_js_1.ForbiddenException("Only SUPER_ADMIN or ADMIN can assign user roles");
    }
    assertTargetModificationAuthority(actor, targetUser, branchContext) {
        const actorRole = actor.roleNumber;
        if (targetUser.roleNumber === index_js_1.UserRole.SUPER_ADMIN && actorRole !== index_js_1.UserRole.SUPER_ADMIN) {
            throw new domain_exception_js_1.ForbiddenException("SUPER_ADMIN account is protected and cannot be modified by non-SUPER_ADMIN users");
        }
        if (targetUser.roleNumber === index_js_1.UserRole.ADMIN && actorRole !== index_js_1.UserRole.SUPER_ADMIN) {
            const isSelf = actor._id?.toString() === targetUser._id?.toString();
            if (!isSelf) {
                throw new domain_exception_js_1.ForbiddenException("Only SUPER_ADMIN can modify other ADMIN accounts");
            }
        }
        if (branchContext && !branchContext.isCentralAdmin) {
            const targetBranch = targetUser.branchId?.toString() || targetUser.primaryBranchId?.toString();
            if (!targetBranch || !branchContext.allowedBranchIds.includes(targetBranch)) {
                throw new domain_exception_js_1.ForbiddenException("Cross-branch user access denied");
            }
        }
    }
    async listStaffUsers(query, branchContext) {
        const filter = {};
        if (query.roleNumber !== undefined && query.roleNumber !== "") {
            const parsedRole = Number(query.roleNumber);
            if (!index_js_1.ALL_USER_ROLES.includes(parsedRole)) {
                throw new domain_exception_js_1.BadRequestException("Invalid roleNumber filter");
            }
            filter.roleNumber = parsedRole;
        }
        if (query.isActive !== undefined && query.isActive !== "") {
            filter.isActive = query.isActive === true || query.isActive === "true";
        }
        if (query.status) {
            filter.accountStatus = query.status;
        }
        if (!branchContext?.isCentralAdmin) {
            const allowedIds = (branchContext?.allowedBranchIds || []).map((id) => new mongoose_1.default.Types.ObjectId(id));
            if (query.branchId) {
                if (!branchContext?.allowedBranchIds.includes(query.branchId)) {
                    throw new domain_exception_js_1.ForbiddenException("Cross-branch access denied");
                }
                const bId = new mongoose_1.default.Types.ObjectId(query.branchId);
                filter.$or = [{ branchId: bId }, { primaryBranchId: bId }, { assignedBranchIds: bId }];
            }
            else {
                filter.$or = [
                    { branchId: { $in: allowedIds } },
                    { primaryBranchId: { $in: allowedIds } },
                    { assignedBranchIds: { $in: allowedIds } },
                ];
            }
        }
        else if (query.branchId) {
            if (!mongoose_1.default.Types.ObjectId.isValid(query.branchId)) {
                throw new domain_exception_js_1.BadRequestException("Invalid branchId filter");
            }
            const bId = new mongoose_1.default.Types.ObjectId(query.branchId);
            filter.$or = [{ branchId: bId }, { primaryBranchId: bId }, { assignedBranchIds: bId }];
        }
        if (query.search) {
            const esc = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.$and = [
                ...(filter.$and || []),
                {
                    $or: [
                        { firstName: { $regex: esc, $options: "i" } },
                        { lastName: { $regex: esc, $options: "i" } },
                        { email: { $regex: esc, $options: "i" } },
                        { employeeCode: { $regex: esc, $options: "i" } },
                    ],
                },
            ];
        }
        return await this.userRepository.paginate({
            filter,
            projection: "-password",
            page: Number(query.page) || 1,
            limit: Number(query.limit) || 20,
        });
    }
    async getUserById(targetUserId, actor, branchContext) {
        const user = await this.userRepository.findById({ id: targetUserId, projection: "-password" });
        if (!user) {
            throw new domain_exception_js_1.NotFoundException("User not found");
        }
        if (branchContext && !branchContext.isCentralAdmin) {
            const targetBranch = user.branchId?.toString() || user.primaryBranchId?.toString();
            const allowed = (targetBranch && branchContext.allowedBranchIds.includes(targetBranch)) ||
                (Array.isArray(user.assignedBranchIds) &&
                    user.assignedBranchIds.some((b) => branchContext.allowedBranchIds.includes(b.toString())));
            if (!allowed && actor._id?.toString() !== user._id?.toString()) {
                throw new domain_exception_js_1.ForbiddenException("Cross-branch access denied");
            }
        }
        return user;
    }
    async createStaffUser(inputs, actor, branchContext) {
        const targetRoleNumber = inputs.roleNumber ?? index_js_1.UserRole.EMPLOYEE;
        this.assertRoleAssignmentAuthority(actor, targetRoleNumber);
        const email = inputs.email.toLowerCase().trim();
        const exists = await this.userRepository.findOne({ filter: { email } });
        if (exists) {
            throw new domain_exception_js_1.ConflictException("User with this email already exists");
        }
        const resolvedBranchId = inputs.branchId || inputs.primaryBranchId || null;
        if (branchContext && !branchContext.isCentralAdmin && resolvedBranchId) {
            if (!branchContext.allowedBranchIds.includes(resolvedBranchId.toString())) {
                throw new domain_exception_js_1.ForbiddenException("Cannot create a user in an unauthorized branch");
            }
        }
        const assignedBranches = new Set(inputs.assignedBranchIds || []);
        if (resolvedBranchId) {
            assignedBranches.add(resolvedBranchId.toString());
        }
        let firstName = inputs.firstName;
        let lastName = inputs.lastName;
        const fullName = inputs.name || inputs.userName;
        if ((!firstName || !lastName) && fullName) {
            const parts = fullName.trim().split(/\s+/);
            firstName = firstName || parts[0];
            lastName = lastName || parts.slice(1).join(" ") || parts[0];
        }
        const isActive = inputs.isActive !== undefined ? Boolean(inputs.isActive) : true;
        const accountStatus = isActive ? index_js_1.UserAccountStatus.ACTIVE : index_js_1.UserAccountStatus.SUSPENDED;
        const created = await this.userRepository.createOne({
            data: {
                firstName,
                lastName,
                email,
                password: inputs.password,
                roleNumber: targetRoleNumber,
                branchId: resolvedBranchId,
                primaryBranchId: resolvedBranchId,
                assignedBranchIds: Array.from(assignedBranches),
                canAccessAllBranches: inputs.canAccessAllBranches !== undefined
                    ? Boolean(inputs.canAccessAllBranches)
                    : targetRoleNumber === index_js_1.UserRole.SUPER_ADMIN || targetRoleNumber === index_js_1.UserRole.ADMIN,
                isActive,
                accountStatus,
                phone: inputs.phone,
                gender: inputs.gender,
                confirmEmail: new Date(),
                employeeCode: inputs.employeeCode,
                createdBy: actor._id,
            },
        });
        await audit_service_js_1.auditService.record({
            actorId: actor._id,
            actorEmail: actor.email,
            action: "USER_CREATED",
            module: "users",
            entityType: "User",
            entityId: created._id.toString(),
            branchId: resolvedBranchId,
            newValues: created.toObject(),
        });
        return created;
    }
    async updateUser(targetUserId, inputs, actor, branchContext) {
        const user = await this.userRepository.findById({ id: targetUserId });
        if (!user) {
            throw new domain_exception_js_1.NotFoundException("User not found");
        }
        this.assertTargetModificationAuthority(actor, user, branchContext);
        const prev = user.toObject();
        if (inputs.email && inputs.email.toLowerCase().trim() !== user.email) {
            const email = inputs.email.toLowerCase().trim();
            const dup = await index_js_3.UserModel.findOne({ email, _id: { $ne: user._id } });
            if (dup) {
                throw new domain_exception_js_1.ConflictException("Email is already in use by another user");
            }
            user.email = email;
        }
        const fullName = inputs.name || inputs.userName;
        if (fullName) {
            user.userName = fullName;
        }
        if (inputs.firstName)
            user.firstName = inputs.firstName;
        if (inputs.lastName)
            user.lastName = inputs.lastName;
        if (inputs.phone !== undefined)
            user.phone = inputs.phone;
        if (inputs.gender !== undefined)
            user.gender = inputs.gender;
        if (inputs.employeeCode !== undefined)
            user.employeeCode = inputs.employeeCode;
        if (inputs.branchId !== undefined || inputs.primaryBranchId !== undefined) {
            const newBranch = inputs.branchId !== undefined ? inputs.branchId : inputs.primaryBranchId;
            user.branchId = newBranch;
            user.primaryBranchId = newBranch;
        }
        if (Array.isArray(inputs.assignedBranchIds)) {
            user.assignedBranchIds = inputs.assignedBranchIds;
        }
        if (inputs.canAccessAllBranches !== undefined) {
            user.canAccessAllBranches = Boolean(inputs.canAccessAllBranches);
        }
        if (inputs.isActive !== undefined || inputs.accountStatus !== undefined) {
            let nextStatus = inputs.accountStatus;
            let nextActive = inputs.isActive;
            if (nextStatus) {
                nextActive = nextStatus === index_js_1.UserAccountStatus.ACTIVE;
            }
            else if (nextActive !== undefined) {
                nextStatus = nextActive ? index_js_1.UserAccountStatus.ACTIVE : index_js_1.UserAccountStatus.SUSPENDED;
            }
            if (!nextActive && actor._id?.toString() === targetUserId.toString()) {
                throw new domain_exception_js_1.ForbiddenException("Users cannot deactivate their own account");
            }
            if (user.roleNumber === index_js_1.UserRole.SUPER_ADMIN && !nextActive) {
                const otherSuperAdmins = await index_js_3.UserModel.countDocuments({
                    roleNumber: index_js_1.UserRole.SUPER_ADMIN,
                    isActive: true,
                    _id: { $ne: user._id },
                });
                if (otherSuperAdmins === 0) {
                    throw new domain_exception_js_1.ForbiddenException("Cannot deactivate the only active SUPER_ADMIN account");
                }
            }
            user.isActive = Boolean(nextActive);
            user.accountStatus = nextStatus || (user.isActive ? index_js_1.UserAccountStatus.ACTIVE : index_js_1.UserAccountStatus.SUSPENDED);
            if (!user.isActive) {
                user.changeCredentialsTime = new Date();
                await index_js_3.UserSessionModel.updateMany({ userId: user._id, isRevoked: false }, { $set: { isRevoked: true, revokedReason: "USER_DEACTIVATED", revokedAt: new Date() } });
            }
        }
        user.updatedBy = actor._id;
        await user.save();
        await audit_service_js_1.auditService.record({
            actorId: actor._id,
            actorEmail: actor.email,
            action: "USER_UPDATED",
            module: "users",
            entityType: "User",
            entityId: user._id.toString(),
            branchId: user.branchId || user.primaryBranchId,
            previousValues: prev,
            newValues: user.toObject(),
        });
        return user;
    }
    async updateProfile(actor, inputs) {
        const existingUser = await this.userRepository.findById({ id: actor._id.toString() });
        if (!existingUser) {
            throw new domain_exception_js_1.NotFoundException("User not found");
        }
        const fullName = inputs.name || inputs.userName;
        if (fullName) {
            existingUser.userName = fullName;
        }
        if (inputs.firstName)
            existingUser.firstName = inputs.firstName;
        if (inputs.lastName)
            existingUser.lastName = inputs.lastName;
        if (inputs.phone) {
            existingUser.phone = await (0, index_js_2.encryption)(inputs.phone);
        }
        if (inputs.gender === 0 || inputs.gender === 1) {
            existingUser.gender = inputs.gender;
        }
        await existingUser.save();
        return existingUser;
    }
    async changeUserRole(targetUserId, newRoleNumber, actor, reason) {
        if (actor._id?.toString() === targetUserId.toString()) {
            throw new domain_exception_js_1.ForbiddenException("Users are not allowed to change their own role");
        }
        this.assertRoleAssignmentAuthority(actor, newRoleNumber);
        const user = await this.userRepository.findById({ id: targetUserId });
        if (!user) {
            throw new domain_exception_js_1.NotFoundException("User not found");
        }
        this.assertTargetModificationAuthority(actor, user);
        if (user.roleNumber === index_js_1.UserRole.SUPER_ADMIN && newRoleNumber !== index_js_1.UserRole.SUPER_ADMIN) {
            const otherSuperAdmins = await index_js_3.UserModel.countDocuments({
                roleNumber: index_js_1.UserRole.SUPER_ADMIN,
                isActive: true,
                _id: { $ne: user._id },
            });
            if (otherSuperAdmins === 0) {
                throw new domain_exception_js_1.ForbiddenException("Cannot demote the last active SUPER_ADMIN account");
            }
        }
        const previousRole = user.roleNumber;
        user.roleNumber = newRoleNumber;
        if (newRoleNumber === index_js_1.UserRole.SUPER_ADMIN || newRoleNumber === index_js_1.UserRole.ADMIN) {
            user.canAccessAllBranches = true;
        }
        user.changeCredentialsTime = new Date();
        user.updatedBy = actor._id;
        await user.save();
        await index_js_3.UserSessionModel.updateMany({ userId: user._id, isRevoked: false }, { $set: { isRevoked: true, revokedReason: "ROLE_CHANGED", revokedAt: new Date() } });
        await audit_service_js_1.auditService.record({
            actorId: actor._id,
            actorEmail: actor.email,
            action: "USER_ROLE_CHANGED",
            module: "users",
            entityType: "User",
            entityId: user._id.toString(),
            branchId: user.branchId || user.primaryBranchId,
            previousValues: { roleNumber: previousRole, roleName: index_js_1.USER_ROLE_LABELS[previousRole] },
            newValues: { roleNumber: newRoleNumber, roleName: index_js_1.USER_ROLE_LABELS[newRoleNumber], reason },
        });
        return user;
    }
    async adminResetPassword(targetUserId, newPassword, actor) {
        const user = await this.userRepository.findById({ id: targetUserId });
        if (!user) {
            throw new domain_exception_js_1.NotFoundException("User not found");
        }
        this.assertTargetModificationAuthority(actor, user);
        user.password = await (0, index_js_2.hashed)({ plainText: newPassword });
        user.changeCredentialsTime = new Date();
        user.failedLoginAttempts = 0;
        user.lockUntil = null;
        user.updatedBy = actor._id;
        await user.save();
        await index_js_3.UserSessionModel.updateMany({ userId: user._id, isRevoked: false }, { $set: { isRevoked: true, revokedReason: "ADMIN_PASSWORD_RESET", revokedAt: new Date() } });
        await audit_service_js_1.auditService.record({
            actorId: actor._id,
            actorEmail: actor.email,
            action: "USER_PASSWORD_RESET_BY_ADMIN",
            module: "users",
            entityType: "User",
            entityId: user._id.toString(),
            branchId: user.branchId || user.primaryBranchId,
        });
        return { message: "User password reset successfully and active sessions revoked" };
    }
    async deleteOrDeactivateUser(targetUserId, actor, branchContext) {
        if (actor._id?.toString() === targetUserId.toString()) {
            throw new domain_exception_js_1.ForbiddenException("Users cannot delete their own account");
        }
        const user = await this.userRepository.findById({ id: targetUserId });
        if (!user) {
            throw new domain_exception_js_1.NotFoundException("User not found");
        }
        if (user.roleNumber === index_js_1.UserRole.SUPER_ADMIN) {
            throw new domain_exception_js_1.ForbiddenException("SUPER_ADMIN accounts cannot be deleted");
        }
        this.assertTargetModificationAuthority(actor, user, branchContext);
        user.isActive = false;
        user.accountStatus = index_js_1.UserAccountStatus.ARCHIVED;
        user.deletedAt = new Date();
        user.changeCredentialsTime = new Date();
        user.updatedBy = actor._id;
        await user.save();
        await index_js_3.UserSessionModel.updateMany({ userId: user._id, isRevoked: false }, { $set: { isRevoked: true, revokedReason: "USER_DELETED", revokedAt: new Date() } });
        await audit_service_js_1.auditService.record({
            actorId: actor._id,
            actorEmail: actor.email,
            action: "USER_DELETED",
            module: "users",
            entityType: "User",
            entityId: user._id.toString(),
            branchId: user.branchId || user.primaryBranchId,
        });
        return { message: "User account deactivated and archived successfully" };
    }
}
exports.UserService = UserService;
exports.default = new UserService();
