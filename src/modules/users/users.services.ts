import mongoose from "mongoose";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "../../common/exception/domain.exception.js";
import { ALL_USER_ROLES, USER_ROLE_LABELS, UserAccountStatus, UserRole } from "../../common/enum/index.js";
import { IUser } from "../../common/interface/user.interface.js";
import { UserRepository } from "../../common/repository/user.repository.js";
import { encryption, hashed } from "../../common/security/index.js";
import { IBranchScopeContext } from "../../common/types/express.types.js";
import { UserModel, UserSessionModel } from "../../DB/module/index.js";
import { auditService } from "../../common/service/audit.service.js";

export class UserService {
  private userRepository: UserRepository;
  constructor() {
    this.userRepository = new UserRepository();
  }

  private assertRoleAssignmentAuthority(actor: IUser, targetRoleNumber: UserRole): void {
    if (!ALL_USER_ROLES.includes(targetRoleNumber)) {
      throw new BadRequestException("Invalid roleNumber");
    }
    const actorRole = actor.roleNumber;
    if (actorRole === UserRole.SUPER_ADMIN) {
      return;
    }
    if (actorRole === UserRole.ADMIN) {
      if (targetRoleNumber === UserRole.SUPER_ADMIN || targetRoleNumber === UserRole.ADMIN) {
        throw new ForbiddenException("ADMIN cannot assign SUPER_ADMIN or ADMIN roles");
      }
      return;
    }
    throw new ForbiddenException("Only SUPER_ADMIN or ADMIN can assign user roles");
  }

  private assertTargetModificationAuthority(actor: IUser, targetUser: IUser, branchContext?: IBranchScopeContext): void {
    const actorRole = actor.roleNumber;
    if (targetUser.roleNumber === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("SUPER_ADMIN account is protected and cannot be modified by non-SUPER_ADMIN users");
    }
    if (targetUser.roleNumber === UserRole.ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      const isSelf = actor._id?.toString() === targetUser._id?.toString();
      if (!isSelf) {
        throw new ForbiddenException("Only SUPER_ADMIN can modify other ADMIN accounts");
      }
    }
    if (branchContext && !branchContext.isCentralAdmin) {
      const targetBranch = targetUser.branchId?.toString() || targetUser.primaryBranchId?.toString();
      if (!targetBranch || !branchContext.allowedBranchIds.includes(targetBranch)) {
        throw new ForbiddenException("Cross-branch user access denied");
      }
    }
  }

  async listStaffUsers(
    query: {
      page?: number;
      limit?: number;
      branchId?: string;
      roleNumber?: number | string;
      isActive?: boolean | string;
      status?: string;
      search?: string;
    },
    branchContext?: IBranchScopeContext,
  ) {
    const filter: Record<string, any> = {};

    if (query.roleNumber !== undefined && query.roleNumber !== "") {
      const parsedRole = Number(query.roleNumber);
      if (!ALL_USER_ROLES.includes(parsedRole as UserRole)) {
        throw new BadRequestException("Invalid roleNumber filter");
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
      const allowedIds = (branchContext?.allowedBranchIds || []).map((id) => new mongoose.Types.ObjectId(id));
      if (query.branchId) {
        if (!branchContext?.allowedBranchIds.includes(query.branchId)) {
          throw new ForbiddenException("Cross-branch access denied");
        }
        const bId = new mongoose.Types.ObjectId(query.branchId);
        filter.$or = [{ branchId: bId }, { primaryBranchId: bId }, { assignedBranchIds: bId }];
      } else {
        filter.$or = [
          { branchId: { $in: allowedIds } },
          { primaryBranchId: { $in: allowedIds } },
          { assignedBranchIds: { $in: allowedIds } },
        ];
      }
    } else if (query.branchId) {
      if (!mongoose.Types.ObjectId.isValid(query.branchId)) {
        throw new BadRequestException("Invalid branchId filter");
      }
      const bId = new mongoose.Types.ObjectId(query.branchId);
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

  async getUserById(targetUserId: string, actor: IUser, branchContext?: IBranchScopeContext) {
    const user = await this.userRepository.findById({ id: targetUserId, projection: "-password" });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (branchContext && !branchContext.isCentralAdmin) {
      const targetBranch = user.branchId?.toString() || user.primaryBranchId?.toString();
      const allowed =
        (targetBranch && branchContext.allowedBranchIds.includes(targetBranch)) ||
        (Array.isArray(user.assignedBranchIds) &&
          user.assignedBranchIds.some((b) => branchContext.allowedBranchIds.includes(b.toString())));
      if (!allowed && actor._id?.toString() !== user._id?.toString()) {
        throw new ForbiddenException("Cross-branch access denied");
      }
    }
    return user;
  }

  async createStaffUser(inputs: any, actor: IUser, branchContext?: IBranchScopeContext) {
    const targetRoleNumber: UserRole = inputs.roleNumber ?? UserRole.EMPLOYEE;
    this.assertRoleAssignmentAuthority(actor, targetRoleNumber);

    const email = inputs.email.toLowerCase().trim();
    const exists = await this.userRepository.findOne({ filter: { email } });
    if (exists) {
      throw new ConflictException("User with this email already exists");
    }

    const resolvedBranchId = inputs.branchId || inputs.primaryBranchId || null;
    if (branchContext && !branchContext.isCentralAdmin && resolvedBranchId) {
      if (!branchContext.allowedBranchIds.includes(resolvedBranchId.toString())) {
        throw new ForbiddenException("Cannot create a user in an unauthorized branch");
      }
    }

    const assignedBranches = new Set<string>(inputs.assignedBranchIds || []);
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
    const accountStatus = isActive ? UserAccountStatus.ACTIVE : UserAccountStatus.SUSPENDED;

    const created = await this.userRepository.createOne({
      data: {
        firstName,
        lastName,
        email,
        password: inputs.password,
        roleNumber: targetRoleNumber,
        branchId: resolvedBranchId as any,
        primaryBranchId: resolvedBranchId as any,
        assignedBranchIds: Array.from(assignedBranches) as any,
        canAccessAllBranches:
          inputs.canAccessAllBranches !== undefined
            ? Boolean(inputs.canAccessAllBranches)
            : targetRoleNumber === UserRole.SUPER_ADMIN || targetRoleNumber === UserRole.ADMIN,
        isActive,
        accountStatus,
        phone: inputs.phone,
        gender: inputs.gender,
        confirmEmail: new Date(),
        employeeCode: inputs.employeeCode,
        createdBy: actor._id as any,
      },
    });

    await auditService.record({
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

  async updateUser(targetUserId: string, inputs: any, actor: IUser, branchContext?: IBranchScopeContext) {
    const user = await this.userRepository.findById({ id: targetUserId });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    this.assertTargetModificationAuthority(actor, user, branchContext);

    const prev = user.toObject();

    if (inputs.email && inputs.email.toLowerCase().trim() !== user.email) {
      const email = inputs.email.toLowerCase().trim();
      const dup = await UserModel.findOne({ email, _id: { $ne: user._id } });
      if (dup) {
        throw new ConflictException("Email is already in use by another user");
      }
      user.email = email;
    }

    const fullName = inputs.name || inputs.userName;
    if (fullName) {
      user.userName = fullName;
    }
    if (inputs.firstName) user.firstName = inputs.firstName;
    if (inputs.lastName) user.lastName = inputs.lastName;
    if (inputs.phone !== undefined) user.phone = inputs.phone;
    if (inputs.gender !== undefined) user.gender = inputs.gender;
    if (inputs.employeeCode !== undefined) user.employeeCode = inputs.employeeCode;

    if (inputs.branchId !== undefined || inputs.primaryBranchId !== undefined) {
      const newBranch = inputs.branchId !== undefined ? inputs.branchId : inputs.primaryBranchId;
      user.branchId = newBranch as any;
      user.primaryBranchId = newBranch as any;
    }
    if (Array.isArray(inputs.assignedBranchIds)) {
      user.assignedBranchIds = inputs.assignedBranchIds as any;
    }
    if (inputs.canAccessAllBranches !== undefined) {
      user.canAccessAllBranches = Boolean(inputs.canAccessAllBranches);
    }
    if (inputs.isActive !== undefined || inputs.accountStatus !== undefined) {
      let nextStatus = inputs.accountStatus as UserAccountStatus | undefined;
      let nextActive = inputs.isActive as boolean | undefined;

      if (nextStatus) {
        nextActive = nextStatus === UserAccountStatus.ACTIVE;
      } else if (nextActive !== undefined) {
        nextStatus = nextActive ? UserAccountStatus.ACTIVE : UserAccountStatus.SUSPENDED;
      }

      if (!nextActive && actor._id?.toString() === targetUserId.toString()) {
        throw new ForbiddenException("Users cannot deactivate their own account");
      }

      if (user.roleNumber === UserRole.SUPER_ADMIN && !nextActive) {
        const otherSuperAdmins = await UserModel.countDocuments({
          roleNumber: UserRole.SUPER_ADMIN,
          isActive: true,
          _id: { $ne: user._id },
        });
        if (otherSuperAdmins === 0) {
          throw new ForbiddenException("Cannot deactivate the only active SUPER_ADMIN account");
        }
      }
      user.isActive = Boolean(nextActive);
      user.accountStatus = nextStatus || (user.isActive ? UserAccountStatus.ACTIVE : UserAccountStatus.SUSPENDED);
      if (!user.isActive) {
        user.changeCredentialsTime = new Date();
        await UserSessionModel.updateMany(
          { userId: user._id, isRevoked: false },
          { $set: { isRevoked: true, revokedReason: "USER_DEACTIVATED", revokedAt: new Date() } },
        );
      }
    }

    user.updatedBy = actor._id as any;
    await user.save();

    await auditService.record({
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

  async updateProfile(actor: IUser, inputs: { firstName?: string; lastName?: string; name?: string; userName?: string; phone?: string; gender?: number }) {
    const existingUser = await this.userRepository.findById({ id: actor._id!.toString() });
    if (!existingUser) {
      throw new NotFoundException("User not found");
    }

    const fullName = inputs.name || inputs.userName;
    if (fullName) {
      existingUser.userName = fullName;
    }
    if (inputs.firstName) existingUser.firstName = inputs.firstName;
    if (inputs.lastName) existingUser.lastName = inputs.lastName;
    if (inputs.phone) {
      existingUser.phone =   await encryption(inputs.phone);
    }
    if (inputs.gender === 0 || inputs.gender === 1) {
      existingUser.gender = inputs.gender;
    }

    await existingUser.save();
    return existingUser;
  }

  async changeUserRole(targetUserId: string, newRoleNumber: UserRole, actor: IUser, reason?: string) {
    if (actor._id?.toString() === targetUserId.toString()) {
      throw new ForbiddenException("Users are not allowed to change their own role");
    }

    this.assertRoleAssignmentAuthority(actor, newRoleNumber);

    const user = await this.userRepository.findById({ id: targetUserId });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    this.assertTargetModificationAuthority(actor, user);

    if (user.roleNumber === UserRole.SUPER_ADMIN && newRoleNumber !== UserRole.SUPER_ADMIN) {
      const otherSuperAdmins = await UserModel.countDocuments({
        roleNumber: UserRole.SUPER_ADMIN,
        isActive: true,
        _id: { $ne: user._id },
      });
      if (otherSuperAdmins === 0) {
        throw new ForbiddenException("Cannot demote the last active SUPER_ADMIN account");
      }
    }

    const previousRole = user.roleNumber;
    user.roleNumber = newRoleNumber;
    if (newRoleNumber === UserRole.SUPER_ADMIN || newRoleNumber === UserRole.ADMIN) {
      user.canAccessAllBranches = true;
    }
    user.changeCredentialsTime = new Date();
    user.updatedBy = actor._id as any;
    await user.save();

    await UserSessionModel.updateMany(
      { userId: user._id, isRevoked: false },
      { $set: { isRevoked: true, revokedReason: "ROLE_CHANGED", revokedAt: new Date() } },
    );

    await auditService.record({
      actorId: actor._id,
      actorEmail: actor.email,
      action: "USER_ROLE_CHANGED",
      module: "users",
      entityType: "User",
      entityId: user._id.toString(),
      branchId: user.branchId || user.primaryBranchId,
      previousValues: { roleNumber: previousRole, roleName: USER_ROLE_LABELS[previousRole] },
      newValues: { roleNumber: newRoleNumber, roleName: USER_ROLE_LABELS[newRoleNumber], reason },
    });

    return user;
  }

  async adminResetPassword(targetUserId: string, newPassword: string, actor: IUser) {
    const user = await this.userRepository.findById({ id: targetUserId });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    this.assertTargetModificationAuthority(actor, user);

    user.password = await hashed({ plainText: newPassword });
    user.changeCredentialsTime = new Date();
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.updatedBy = actor._id as any;
    await user.save();

    await UserSessionModel.updateMany(
      { userId: user._id, isRevoked: false },
      { $set: { isRevoked: true, revokedReason: "ADMIN_PASSWORD_RESET", revokedAt: new Date() } },
    );

    await auditService.record({
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

  async deleteOrDeactivateUser(targetUserId: string, actor: IUser, branchContext?: IBranchScopeContext) {
    if (actor._id?.toString() === targetUserId.toString()) {
      throw new ForbiddenException("Users cannot delete their own account");
    }

    const user = await this.userRepository.findById({ id: targetUserId });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.roleNumber === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("SUPER_ADMIN accounts cannot be deleted");
    }

    this.assertTargetModificationAuthority(actor, user, branchContext);

    user.isActive = false;
    user.accountStatus = UserAccountStatus.ARCHIVED;
    user.deletedAt = new Date();
    user.changeCredentialsTime = new Date();
    user.updatedBy = actor._id as any;
    await user.save();

    await UserSessionModel.updateMany(
      { userId: user._id, isRevoked: false },
      { $set: { isRevoked: true, revokedReason: "USER_DELETED", revokedAt: new Date() } },
    );

    await auditService.record({
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

export default new UserService();
