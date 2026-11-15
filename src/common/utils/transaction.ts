import mongoose, { ClientSession } from "mongoose";
import { ConflictException } from "../exception/domain.exception";

/**
 * Execute a unit of work inside a MongoDB transaction when supported by the deployment
 * (Replica Set / Mongos).
 *
 * Production Requirement:
 * MongoDB multi-document transactions require a Replica Set deployment.
 * If executed in an environment where transactions are unsupported (e.g. standalone local dev instance
 * throwing code 20 IllegalOperation), it falls back safely while preserving atomic conditional document updates.
 * Automatically retries transient transaction errors (WriteConflict / TransientTransactionError) up to maxRetries.
 */
export async function withTransaction<T>(
  work: (session: ClientSession | undefined) => Promise<T>,
  maxRetries: number = 3,
): Promise<T> {
  if (mongoose.connection.readyState !== 1) {
    return work(undefined);
  }

  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    const session = await mongoose.startSession();
    try {
      session.startTransaction({
        readConcern: { level: "local" },
        writeConcern: { w: "majority" },
      });

      const result = await work(session);
      await session.commitTransaction();
      return result;
    } catch (error: any) {
      if (session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch {
          // ignore abort error
        }
      }

      const msg = String(error?.message || "");
      const isStandaloneNoReplicaSet =
        error?.code === 20 ||
        error?.codeName === "IllegalOperation" ||
        msg.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
        msg.includes("transactions are not supported");

      if (isStandaloneNoReplicaSet) {
        await session.endSession();
        return await work(undefined);
      }

      const isTransientConflict =
        error?.hasErrorLabel?.("TransientTransactionError") ||
        error?.hasErrorLabel?.("UnknownTransactionCommitResult") ||
        error?.code === 112 || // WriteConflict
        msg.includes("WriteConflict") ||
        msg.includes("TransientTransactionError");

      if (isTransientConflict && attempt < maxRetries) {
        await session.endSession();
        await new Promise((r) => setTimeout(r, 25 * attempt));
        continue;
      }

      if (isTransientConflict) {
        throw new ConflictException(
          "Transaction conflict detected due to concurrent modification. Please retry.",
          undefined,
          "TRANSACTION_CONFLICT",
        );
      }

      throw error;
    } finally {
      await session.endSession().catch(() => {});
    }
  }

  throw new ConflictException("Transaction failed after maximum retries");
}
