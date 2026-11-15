import { ClientSession } from "mongoose";
import { DocumentSequenceModel, SequenceDocumentType } from "../../DB/module/documentSequence.model";

const DEFAULT_PREFIXES: Record<SequenceDocumentType, string> = {
  BOOKING: "BK",
  RECEIPT: "RCV",
  PAYMENT_VOUCHER: "PV",
  EXPENSE: "EXP",
  TRANSFER: "TRF",
  CONTRACT: "CTR",
  JOURNAL_ENTRY: "JE",
  MANIFEST: "MNF",
  TRIP: "TRP",
  WHOLESALE: "WSL",
};

export class SequenceService {
  /**
   * Generates a guaranteed unique, concurrency-safe sequential document reference number.
   * Format: <PREFIX>-<BRANCH_CODE>-<YEAR>-<PADDED_SEQ> (e.g., BK-CAI-2026-000001)
   */
  async nextReference({
    documentType,
    branchCode = "HQ",
    prefix,
    year = new Date().getFullYear(),
    padding = 6,
    session,
  }: {
    documentType: SequenceDocumentType;
    branchCode?: string;
    prefix?: string;
    year?: number;
    padding?: number;
    session?: ClientSession | undefined;
  }): Promise<string> {
    const cleanBranch = (branchCode || "HQ").toUpperCase().trim();
    const resolvedPrefix = (prefix || DEFAULT_PREFIXES[documentType] || documentType.slice(0, 3)).toUpperCase();
    const key = `${documentType}:${cleanBranch}:${year}`;

    const doc = await DocumentSequenceModel.findOneAndUpdate(
      { key },
      {
        $inc: { currentValue: 1 },
        $setOnInsert: {
          documentType,
          prefix: resolvedPrefix,
          branchCode: cleanBranch,
          year,
          padding,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        ...(session ? { session } : {}),
      },
    ).exec();

    const seqNum = String(doc!.currentValue).padStart(padding, "0");
    return `${resolvedPrefix}-${cleanBranch}-${year}-${seqNum}`;
  }
}

export const sequenceService = new SequenceService();
