"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseRepository = void 0;
class DatabaseRepository {
    model;
    constructor(model) {
        this.model = model;
    }
    formatUpdatePayload(data) {
        if (Array.isArray(data)) {
            return [...data, { $set: { __v: { $add: [{ $ifNull: ["$__v", 0] }, 1] } } }];
        }
        return {
            ...data,
            $inc: { ...(data?.$inc || {}), __v: 1 },
        };
    }
    async create({ data, options, }) {
        return await this.model.create(data, options);
    }
    async createOne({ data, options = { validateBeforeSave: true }, }) {
        const [doc] = (await this.create({ data: [data], options }));
        return doc;
    }
    async findOne({ filter = {}, projection, options, }) {
        const query = this.model.findOne(filter, projection, options);
        if (options?.populate)
            query.populate(options.populate);
        if (options?.lean)
            query.lean(options.lean);
        return await query.exec();
    }
    async findById({ id, projection, options, }) {
        const query = this.model.findById(id, projection, options);
        if (options?.populate)
            query.populate(options.populate);
        if (options?.lean)
            query.lean(options.lean);
        return await query.exec();
    }
    async find({ filter = {}, projection, options, }) {
        const query = this.model.find(filter, projection);
        if (options?.populate)
            query.populate(options.populate);
        if (options?.sort)
            query.sort(options.sort);
        if (options?.skip !== undefined)
            query.skip(options.skip);
        if (options?.limit !== undefined)
            query.limit(options.limit);
        if (options?.lean)
            query.lean(options.lean);
        return await query.exec();
    }
    async paginate({ filter = {}, projection, options = { sort: { createdAt: -1 } }, page = 1, limit = 10, }) {
        if (page === "all") {
            const docs = await this.find({ filter, projection, options });
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
            .find(filter, projection, options ?? undefined)
            .skip(skip)
            .limit(parsedLimit);
        if (options?.sort)
            query.sort(options.sort);
        if (options?.populate)
            query.populate(options.populate);
        if (options?.lean)
            query.lean(options.lean);
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
    async updateOne({ filter, data, options = { runValidators: true }, }) {
        const updatedData = this.formatUpdatePayload(data);
        return await this.model.updateOne(filter, updatedData, options);
    }
    async updateMany({ filter, data, options = { runValidators: true }, }) {
        const updatedData = this.formatUpdatePayload(data);
        return await this.model.updateMany(filter, updatedData, options);
    }
    async findByIdAndUpdate({ id, data, options = { returnDocument: "after", runValidators: true }, }) {
        const updatedData = this.formatUpdatePayload(data);
        const query = this.model.findByIdAndUpdate(id, updatedData, {
            returnDocument: "after",
            runValidators: true,
            ...options,
        });
        if (options?.populate)
            query.populate(options.populate);
        if (options?.lean)
            query.lean(options.lean);
        return await query.exec();
    }
    async findOneAndUpdate({ filter, data, options = { returnDocument: "after", runValidators: true }, }) {
        const updatedData = this.formatUpdatePayload(data);
        const query = this.model.findOneAndUpdate(filter, updatedData, {
            returnDocument: "after",
            runValidators: true,
            ...options,
        });
        if (options?.populate)
            query.populate(options.populate);
        if (options?.lean)
            query.lean(options.lean);
        return await query.exec();
    }
    async findByIdAndDelete({ id, options, }) {
        return await this.model.findByIdAndDelete(id, options).exec();
    }
    async findOneAndDelete({ filter, options, }) {
        return await this.model.findOneAndDelete(filter, options).exec();
    }
    async deleteOne({ filter, options, }) {
        return await this.model.deleteOne(filter, options).exec();
    }
    async deleteMany({ filter, options, }) {
        return await this.model.deleteMany(filter, options).exec();
    }
    async countDocuments({ filter = {}, options, }) {
        return await this.model.countDocuments(filter, options).exec();
    }
    async exists({ filter }) {
        return (await this.model.exists(filter).exec());
    }
    async aggregate({ pipeline = [], options = {}, }) {
        return await this.model.aggregate(pipeline).option(options).exec();
    }
}
exports.DatabaseRepository = DatabaseRepository;
