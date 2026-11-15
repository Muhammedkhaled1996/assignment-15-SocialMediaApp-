"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequenceService = exports.SequenceService = void 0;
const documentSequence_model_1 = require("../../DB/module/documentSequence.model");
const DEFAULT_PREFIXES = {
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
class SequenceService {
    async nextReference({ documentType, branchCode = "HQ", prefix, year = new Date().getFullYear(), padding = 6, session, }) {
        const cleanBranch = (branchCode || "HQ").toUpperCase().trim();
        const resolvedPrefix = (prefix || DEFAULT_PREFIXES[documentType] || documentType.slice(0, 3)).toUpperCase();
        const key = `${documentType}:${cleanBranch}:${year}`;
        const doc = await documentSequence_model_1.DocumentSequenceModel.findOneAndUpdate({ key }, {
            $inc: { currentValue: 1 },
            $setOnInsert: {
                documentType,
                prefix: resolvedPrefix,
                branchCode: cleanBranch,
                year,
                padding,
            },
        }, {
            upsert: true,
            returnDocument: "after",
            ...(session ? { session } : {}),
        }).exec();
        const seqNum = String(doc.currentValue).padStart(padding, "0");
        return `${resolvedPrefix}-${cleanBranch}-${year}-${seqNum}`;
    }
}
exports.SequenceService = SequenceService;
exports.sequenceService = new SequenceService();
