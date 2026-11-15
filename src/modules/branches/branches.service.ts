import { Request } from "express";
import { BranchModel, CompanyModel } from "../../DB/module";
import { DatabaseRepository } from "../../common/repository/base.repository";
import { ConflictException, NotFoundException } from "../../common/exception";
import { auditService } from "../../common/service";
import { resolveScopedBranchFilter } from "../../middleware";

export class BranchRepository extends DatabaseRepository<any> {
  constructor() {
    super(BranchModel);
  }
}

export class BranchService {
  private repo = new BranchRepository();

  async ensureDefaultCompanyAndHQBranch() {
    let company = await CompanyModel.findOne({ code: "TROZIANA" });
    if (!company) {
      company = await CompanyModel.create({
        nameAr: "شركة تروزيانا للسياحة",
        nameEn: "Troziana Travel & Tourism",
        code: "TROZIANA",
        baseCurrency: "EGP",
        status: "ACTIVE",
      });
    }

    let hqBranch = await BranchModel.findOne({ code: "HQ-CAI" });
    if (!hqBranch) {
      hqBranch = await BranchModel.create({
        companyId: company._id,
        code: "HQ-CAI",
        nameAr: "الفرع الرئيسي - القاهرة",
        nameEn: "Cairo Headquarters",
        governorate: "Cairo",
        city: "Cairo",
        isHeadquarters: true,
        status: "ACTIVE",
      });
    }
    return { company, hqBranch };
  }

  async createBranch(payload: any, req: Request) {
    const code = payload.code.toUpperCase().trim();
    const exists = await this.repo.findOne({ filter: { code } });
    if (exists) {
      throw new ConflictException(`Branch with code ${code} already exists`);
    }

    const { company } = await this.ensureDefaultCompanyAndHQBranch();
    const branch = await this.repo.createOne({
      data: {
        ...payload,
        code,
        companyId: payload.companyId || company._id,
        createdBy: req.user?._id,
      },
    });

    await auditService.record({
      req,
      action: "BRANCH_CREATED",
      module: "branches",
      entityType: "Branch",
      entityId: branch._id.toString(),
      branchId: branch._id,
      newValues: branch.toObject(),
    });

    return branch;
  }

  async listBranches(query: any, req: Request) {
    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status;
    if (query.governorate) filter.governorate = query.governorate;

    if (!req.branchContext?.isCentralAdmin) {
      const scoped = resolveScopedBranchFilter(req.branchContext, query.branchId, "_id");
      Object.assign(filter, scoped);
    }

    return await this.repo.paginate({
      filter,
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 25,
    });
  }

  async getBranchById(id: string, req: Request) {
    const filter: Record<string, any> = { _id: id };
    if (!req.branchContext?.isCentralAdmin) {
      const scoped = resolveScopedBranchFilter(req.branchContext, id, "_id");
      Object.assign(filter, scoped);
    }
    const branch = await this.repo.findOne({ filter });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
    return branch;
  }

  async updateBranch(id: string, payload: any, req: Request) {
    const existing = await this.getBranchById(id, req);
    const updated = await this.repo.findByIdAndUpdate({
      id,
      data: { ...payload, updatedBy: req.user?._id },
    });
    await auditService.record({
      req,
      action: "BRANCH_UPDATED",
      module: "branches",
      entityType: "Branch",
      entityId: id,
      branchId: id,
      previousValues: existing.toObject(),
      newValues: updated?.toObject(),
    });
    return updated;
  }
}

export const branchService = new BranchService();
export default branchService;
