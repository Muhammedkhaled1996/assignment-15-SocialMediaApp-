"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTransaction = withTransaction;
const mongoose_1 = __importDefault(require("mongoose"));
const domain_exception_1 = require("../exception/domain.exception");
async function withTransaction(work, maxRetries = 3) {
    if (mongoose_1.default.connection.readyState !== 1) {
        return work(undefined);
    }
    let attempt = 0;
    while (attempt < maxRetries) {
        attempt++;
        const session = await mongoose_1.default.startSession();
        try {
            session.startTransaction({
                readConcern: { level: "local" },
                writeConcern: { w: "majority" },
            });
            const result = await work(session);
            await session.commitTransaction();
            return result;
        }
        catch (error) {
            if (session.inTransaction()) {
                try {
                    await session.abortTransaction();
                }
                catch {
                }
            }
            const msg = String(error?.message || "");
            const isStandaloneNoReplicaSet = error?.code === 20 ||
                error?.codeName === "IllegalOperation" ||
                msg.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
                msg.includes("transactions are not supported");
            if (isStandaloneNoReplicaSet) {
                await session.endSession();
                return await work(undefined);
            }
            const isTransientConflict = error?.hasErrorLabel?.("TransientTransactionError") ||
                error?.hasErrorLabel?.("UnknownTransactionCommitResult") ||
                error?.code === 112 ||
                msg.includes("WriteConflict") ||
                msg.includes("TransientTransactionError");
            if (isTransientConflict && attempt < maxRetries) {
                await session.endSession();
                await new Promise((r) => setTimeout(r, 25 * attempt));
                continue;
            }
            if (isTransientConflict) {
                throw new domain_exception_1.ConflictException("Transaction conflict detected due to concurrent modification. Please retry.", undefined, "TRANSACTION_CONFLICT");
            }
            throw error;
        }
        finally {
            await session.endSession().catch(() => { });
        }
    }
    throw new domain_exception_1.ConflictException("Transaction failed after maximum retries");
}
