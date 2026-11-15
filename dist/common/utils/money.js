"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Money = void 0;
const domain_exception_1 = require("../exception/domain.exception");
const MINOR_FACTOR = 100;
const RATE_FACTOR = 10000;
class Money {
    static toMinor(amount) {
        const num = typeof amount === "string" ? Number(amount) : amount;
        if (!Number.isFinite(num)) {
            throw new domain_exception_1.BadRequestException(`Invalid monetary amount: ${amount}`);
        }
        return Math.round((num + Number.EPSILON) * MINOR_FACTOR);
    }
    static fromMinor(minorUnits) {
        if (!Number.isFinite(minorUnits)) {
            throw new domain_exception_1.BadRequestException(`Invalid minor unit amount: ${minorUnits}`);
        }
        return Math.round(minorUnits) / MINOR_FACTOR;
    }
    static round(amount) {
        return Money.fromMinor(Money.toMinor(amount));
    }
    static roundRate(rate) {
        const num = typeof rate === "string" ? Number(rate) : rate;
        if (!Number.isFinite(num)) {
            throw new domain_exception_1.BadRequestException(`Invalid rate: ${rate}`);
        }
        return Math.round((num + Number.EPSILON) * RATE_FACTOR) / RATE_FACTOR;
    }
    static add(...amounts) {
        const totalMinor = amounts.reduce((sum, val) => sum + Money.toMinor(val), 0);
        return Money.fromMinor(totalMinor);
    }
    static subtract(a, b) {
        return Money.fromMinor(Money.toMinor(a) - Money.toMinor(b));
    }
    static multiply(amount, factor) {
        const minor = Money.toMinor(amount);
        const f = typeof factor === "string" ? Number(factor) : factor;
        if (!Number.isFinite(f)) {
            throw new domain_exception_1.BadRequestException(`Invalid multiplication factor: ${factor}`);
        }
        const scaledFactor = Math.round((f + Number.EPSILON) * RATE_FACTOR);
        const resultMinor = Math.round((minor * scaledFactor) / RATE_FACTOR);
        return Money.fromMinor(resultMinor);
    }
    static divide(amount, divisor) {
        if (!Number.isFinite(divisor) || divisor === 0) {
            throw new domain_exception_1.BadRequestException(`Invalid division divisor: ${divisor}`);
        }
        const minor = Money.toMinor(amount);
        const resultMinor = Math.round((minor + Number.EPSILON) / divisor);
        return Money.fromMinor(resultMinor);
    }
    static convert(amount, exchangeRate) {
        return Money.multiply(amount, Money.roundRate(exchangeRate));
    }
    static equals(a, b) {
        return Money.toMinor(a) === Money.toMinor(b);
    }
}
exports.Money = Money;
