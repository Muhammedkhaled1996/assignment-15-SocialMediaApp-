import mongoose, {
  AnyKeys,
  CreateOptions,
  DeleteResult,
  FlattenMaps,
  HydratedDocument,
  Model,
  MongooseBaseQueryOptions,
  MongooseUpdateQueryOptions,
  PipelineStage,
  PopulateOptions,
  ProjectionType,
  QueryFilter,
  QueryOptions,
  UpdateQuery,
  UpdateWithAggregationPipeline,
  UpdateWriteOpResult,
} from "mongoose";

import { IPagination } from "../interface/pagination.interface";

export abstract class DatabaseRepository<TRawDocType> {
  constructor(protected model: Model<TRawDocType>) {}

  /**
   * دالة مساعدة لتجهيز عمليات التعديل مع زيادة الـ __v وتوافق الـ Pipelines
   */
  protected formatUpdatePayload(
    data: UpdateQuery<TRawDocType> | UpdateWithAggregationPipeline,
  ): UpdateQuery<TRawDocType> | UpdateWithAggregationPipeline {
    if (Array.isArray(data)) {
      return [...data, { $set: { __v: { $add: [{ $ifNull: ["$__v", 0] }, 1] } } }] as UpdateWithAggregationPipeline;
    }
    return {
      ...data,
      $inc: { ...((data as any)?.$inc || {}), __v: 1 },
    } as UpdateQuery<TRawDocType>;
  }

  // ==========================================
  // CREATE METHODS
  // ==========================================

  async create({
    data,
    options,
  }: {
    data: AnyKeys<TRawDocType>;
    options?: CreateOptions;
  }): Promise<HydratedDocument<TRawDocType>>;

  async create({
    data,
    options,
  }: {
    data: AnyKeys<TRawDocType>[];
    options?: CreateOptions;
  }): Promise<HydratedDocument<TRawDocType>[]>;

  async create({
    data,
    options,
  }: {
    data: AnyKeys<TRawDocType> | AnyKeys<TRawDocType>[];
    options?: CreateOptions;
  }): Promise<HydratedDocument<TRawDocType> | HydratedDocument<TRawDocType>[]> {
    return await this.model.create(data as any, options);
  }

  async createOne({
    data,
    options = { validateBeforeSave: true },
  }: {
    data: AnyKeys<TRawDocType>;
    options?: CreateOptions;
  }): Promise<HydratedDocument<TRawDocType>> {
    const [doc] = (await this.create({ data: [data], options })) as any;
    return doc;
  }

  // ==========================================
  // FIND METHODS
  // ==========================================

  async findOne({
    filter,
    projection,
    options,
  }: {
    filter: QueryFilter<TRawDocType>;
    projection?: ProjectionType<TRawDocType> | null;
    options?: (QueryOptions<TRawDocType> & { lean?: false }) | null;
  }): Promise<HydratedDocument<TRawDocType> | null>;

  async findOne({
    filter,
    projection,
    options,
  }: {
    filter: QueryFilter<TRawDocType>;
    projection?: ProjectionType<TRawDocType> | null;
    options?: (QueryOptions<TRawDocType> & { lean: true }) | null;
  }): Promise<FlattenMaps<TRawDocType> | null>;

  async findOne({
    filter = {},
    projection,
    options,
  }: {
    filter: QueryFilter<TRawDocType>;
    projection?: ProjectionType<TRawDocType> | null;
    options?: QueryOptions<TRawDocType> | null;
  }): Promise<HydratedDocument<TRawDocType> | FlattenMaps<TRawDocType> | null> {
    const query = this.model.findOne(filter, projection, options);
    if (options?.populate) query.populate(options.populate as PopulateOptions[]);
    if (options?.lean) query.lean(options.lean);
    return await query.exec();
  }

  async findById({
    id,
    projection,
    options,
  }: {
    id: mongoose.Types.ObjectId | string;
    projection?: ProjectionType<TRawDocType> | null;
    options?: (QueryOptions<TRawDocType> & { lean?: false }) | null;
  }): Promise<HydratedDocument<TRawDocType> | null>;

  async findById({
    id,
    projection,
    options,
  }: {
    id: mongoose.Types.ObjectId | string;
    projection?: ProjectionType<TRawDocType> | null;
    options?: (QueryOptions<TRawDocType> & { lean: true }) | null;
  }): Promise<FlattenMaps<TRawDocType> | null>;

  async findById({
    id,
    projection,
    options,
  }: {
    id: mongoose.Types.ObjectId | string;
    projection?: ProjectionType<TRawDocType> | null;
    options?: QueryOptions<TRawDocType> | null;
  }): Promise<HydratedDocument<TRawDocType> | FlattenMaps<TRawDocType> | null> {
    const query = this.model.findById(id, projection, options);
    if (options?.populate) query.populate(options.populate as PopulateOptions[]);
    if (options?.lean) query.lean(options.lean);
    return await query.exec();
  }

  async find({
    filter,
    projection,
    options,
  }: {
    filter?: QueryFilter<TRawDocType>;
    projection?: ProjectionType<TRawDocType> | null;
    options?: (QueryOptions<TRawDocType> & { lean?: false }) | null;
  }): Promise<HydratedDocument<TRawDocType>[]>;

  async find({
    filter,
    projection,
    options,
  }: {
    filter?: QueryFilter<TRawDocType>;
    projection?: ProjectionType<TRawDocType> | null;
    options?: (QueryOptions<TRawDocType> & { lean: true }) | null;
  }): Promise<FlattenMaps<TRawDocType>[]>;

  async find({
    filter = {},
    projection,
    options,
  }: {
    filter?: QueryFilter<TRawDocType>;
    projection?: ProjectionType<TRawDocType> | null;
    options?: QueryOptions<TRawDocType> | null;
  }): Promise<HydratedDocument<TRawDocType>[] | FlattenMaps<TRawDocType>[]> {
    const query = this.model.find(filter as any, projection);
    if (options?.populate) query.populate(options.populate as PopulateOptions[]);
    if (options?.sort) query.sort(options.sort);
    if (options?.skip !== undefined) query.skip(options.skip);
    if (options?.limit !== undefined) query.limit(options.limit);
    if (options?.lean) query.lean(options.lean);
    return await query.exec();
  }

  // ==========================================
  // PAGINATION METHOD
  // ==========================================

  async paginate({
    filter,
    projection,
    options,
    page,
    limit,
  }: {
    filter?: QueryFilter<TRawDocType>;
    projection?: ProjectionType<TRawDocType> | null;
    options?: (QueryOptions<TRawDocType> & { lean?: false }) | null;
    page?: number | "all";
    limit?: number;
  }): Promise<IPagination<HydratedDocument<TRawDocType>>>;

  async paginate({
    filter,
    projection,
    options,
    page,
    limit,
  }: {
    filter?: QueryFilter<TRawDocType>;
    projection?: ProjectionType<TRawDocType> | null;
    options?: (QueryOptions<TRawDocType> & { lean: true }) | null;
    page?: number | "all";
    limit?: number;
  }): Promise<IPagination<FlattenMaps<TRawDocType>>>;

  async paginate({
    filter = {},
    projection,
    options = { sort: { createdAt: -1 } },
    page = 1,
    limit = 10,
  }: {
    filter?: QueryFilter<TRawDocType>;
    projection?: ProjectionType<TRawDocType> | null;
    options?: QueryOptions<TRawDocType> | null;
    page?: number | "all";
    limit?: number;
  }): Promise<IPagination<any>> {
    if (page === "all") {
      const docs = await this.find({ filter, projection, options } as any);
      return {
        totalDocs: docs.length,
        pagination: {
          page: 1,
          limit: docs.length,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
        },
        docs,
      };
    }

    const parsedPage = Math.max(1, typeof page === "number" ? page : parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, typeof limit === "number" ? limit : parseInt(limit, 10) || 10);
    const skip = (parsedPage - 1) * parsedLimit;

    const query = this.model
      .find(filter as any, projection, options ?? undefined)
      .skip(skip)
      .limit(parsedLimit);

    if (options?.sort) query.sort(options.sort);
    if (options?.populate) query.populate(options.populate as PopulateOptions[]);
    if (options?.lean) query.lean(options.lean);

    const [docs, totalDocs] = await Promise.all([query.exec(), this.model.countDocuments(filter)]);

    const totalPages = totalDocs === 0 ? 0 : Math.ceil(totalDocs / parsedLimit);

    return {
      totalDocs,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalPages,
        hasPrevPage: parsedPage > 1,
        hasNextPage: parsedPage < totalPages,
      },
      docs,
    };
  }

  // ==========================================
  // UPDATE METHODS
  // ==========================================

  async updateOne({
    filter,
    data,
    options = { runValidators: true },
  }: {
    filter: QueryFilter<TRawDocType>;
    data: UpdateQuery<TRawDocType> | UpdateWithAggregationPipeline;
    options?: MongooseUpdateQueryOptions<TRawDocType> | null;
  }): Promise<UpdateWriteOpResult> {
    const updatedData = this.formatUpdatePayload(data);
    return await this.model.updateOne(filter, updatedData, options);
  }

  async updateMany({
    filter,
    data,
    options = { runValidators: true },
  }: {
    filter: QueryFilter<TRawDocType>;
    data: UpdateQuery<TRawDocType> | UpdateWithAggregationPipeline;
    options?: MongooseUpdateQueryOptions<TRawDocType> | null;
  }): Promise<UpdateWriteOpResult> {
    const updatedData = this.formatUpdatePayload(data);
    return await this.model.updateMany(filter, updatedData, options);
  }

  async findByIdAndUpdate({
    id,
    data,
    options,
  }: {
    id: mongoose.Types.ObjectId | string;
    data: UpdateQuery<TRawDocType> | UpdateWithAggregationPipeline;
    options?: (QueryOptions<TRawDocType> & { lean?: false }) | null;
  }): Promise<HydratedDocument<TRawDocType> | null>;

  async findByIdAndUpdate({
    id,
    data,
    options,
  }: {
    id: mongoose.Types.ObjectId | string;
    data: UpdateQuery<TRawDocType> | UpdateWithAggregationPipeline;
    options?: (QueryOptions<TRawDocType> & { lean: true }) | null;
  }): Promise<FlattenMaps<TRawDocType> | null>;

  async findByIdAndUpdate({
    id,
    data,
    options = { returnDocument: "after", runValidators: true },
  }: {
    id: mongoose.Types.ObjectId | string;
    data: UpdateQuery<TRawDocType> | UpdateWithAggregationPipeline;
    options?: QueryOptions<TRawDocType> | null;
  }): Promise<HydratedDocument<TRawDocType> | FlattenMaps<TRawDocType> | null> {
    const updatedData = this.formatUpdatePayload(data);
    const query = this.model.findByIdAndUpdate(id, updatedData, {
      returnDocument: "after",
      runValidators: true,
      ...options,
    });
    if (options?.populate) query.populate(options.populate as PopulateOptions[]);
    if (options?.lean) query.lean(options.lean);
    return await query.exec();
  }

  async findOneAndUpdate({
    filter,
    data,
    options,
  }: {
    filter: QueryFilter<TRawDocType>;
    data: UpdateQuery<TRawDocType> | UpdateWithAggregationPipeline;
    options?: (QueryOptions<TRawDocType> & { lean?: false }) | null;
  }): Promise<HydratedDocument<TRawDocType> | null>;

  async findOneAndUpdate({
    filter,
    data,
    options,
  }: {
    filter: QueryFilter<TRawDocType>;
    data: UpdateQuery<TRawDocType> | UpdateWithAggregationPipeline;
    options?: (QueryOptions<TRawDocType> & { lean: true }) | null;
  }): Promise<FlattenMaps<TRawDocType> | null>;

  async findOneAndUpdate({
    filter,
    data,
    options = { returnDocument: "after", runValidators: true },
  }: {
    filter: QueryFilter<TRawDocType>;
    data: UpdateQuery<TRawDocType> | UpdateWithAggregationPipeline;
    options?: QueryOptions<TRawDocType> | null;
  }): Promise<HydratedDocument<TRawDocType> | FlattenMaps<TRawDocType> | null> {
    const updatedData = this.formatUpdatePayload(data);
    const query = this.model.findOneAndUpdate(filter, updatedData, {
      returnDocument: "after",
      runValidators: true,
      ...options,
    });
    if (options?.populate) query.populate(options.populate as PopulateOptions[]);
    if (options?.lean) query.lean(options.lean);
    return await query.exec();
  }

  // ==========================================
  // DELETE METHODS
  // ==========================================

  async findByIdAndDelete({
    id,
    options,
  }: {
    id: mongoose.Types.ObjectId | string;
    options?: QueryOptions<TRawDocType> | null;
  }): Promise<HydratedDocument<TRawDocType> | null> {
    return await this.model.findByIdAndDelete(id, options).exec();
  }

  async findOneAndDelete({
    filter,
    options,
  }: {
    filter: QueryFilter<TRawDocType>;
    options?: QueryOptions<TRawDocType> | null;
  }): Promise<HydratedDocument<TRawDocType> | null> {
    return await this.model.findOneAndDelete(filter, options).exec();
  }

  async deleteOne({
    filter,
    options,
  }: {
    filter: QueryFilter<TRawDocType>;
    options?: MongooseBaseQueryOptions<TRawDocType> | null;
  }): Promise<DeleteResult> {
    return await this.model.deleteOne(filter, options).exec();
  }

  async deleteMany({
    filter,
    options,
  }: {
    filter: QueryFilter<TRawDocType>;
    options?: MongooseBaseQueryOptions<TRawDocType> | null;
  }): Promise<DeleteResult> {
    return await this.model.deleteMany(filter, options).exec();
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  async countDocuments({
    filter = {},
    options,
  }: {
    filter?: QueryFilter<TRawDocType>;
    options?: MongooseBaseQueryOptions<TRawDocType> | null;
  }): Promise<number> {
    return await this.model.countDocuments(filter, options).exec();
  }

  async exists({ filter }: { filter: QueryFilter<TRawDocType> }): Promise<{ _id: mongoose.Types.ObjectId } | null> {
    return (await this.model.exists(filter).exec()) as { _id: mongoose.Types.ObjectId } | null;
  }

  async aggregate<R = any>({
    pipeline = [],
    options = {},
  }: {
    pipeline?: PipelineStage[];
    options?: mongoose.AggregateOptions;
  }): Promise<R[]> {
    return await this.model.aggregate<R>(pipeline).option(options).exec();
  }
}
