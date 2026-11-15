import { BadRequestException } from "../exception/domain.exception";

/**
 * Decimal-safe monetary arithmetic utility for Troziana ERP.
 *
 * Policy:
 * - Currencies (EGP, SAR, USD) have a standard minor unit scale of 2 decimal places (100 piasters / halalas / cents = 1 major unit).
 * - Internal rates and intermediate calculations support 4 decimal places (scale 10000) to avoid premature rounding drift.
 * - Final monetary amounts are rounded using HALF_UP (banker-standard commercial rounding: >= 0.5 rounds away from zero) to 2 decimal places.
 */
export type SupportedCurrency = "EGP" | "SAR" | "USD" | "EUR";

const MINOR_FACTOR = 100;
const RATE_FACTOR = 10000;

export class Money {
  /**
   * Convert a major currency amount (e.g. 1250.55) to integer minor units (125055).
   */
  static toMinor(amount: number | string): number {
    const num = typeof amount === "string" ? Number(amount) : amount;
    if (!Number.isFinite(num)) {
      throw new BadRequestException(`Invalid monetary amount: ${amount}`);
    }
    return Math.round((num + Number.EPSILON) * MINOR_FACTOR);
  }

  /**
   * Convert integer minor units (e.g. 125055) back to major currency units (1250.55).
   */
  static fromMinor(minorUnits: number): number {
    if (!Number.isFinite(minorUnits)) {
      throw new BadRequestException(`Invalid minor unit amount: ${minorUnits}`);
    }
    return Math.round(minorUnits) / MINOR_FACTOR;
  }

  /**
   * Round any number safely to 2 decimal places (commercial HALF_UP).
   */
  static round(amount: number | string): number {
    return Money.fromMinor(Money.toMinor(amount));
  }

  /**
   * Round an exchange rate or ratio to 4 decimal places.
   */
  static roundRate(rate: number | string): number {
    const num = typeof rate === "string" ? Number(rate) : rate;
    if (!Number.isFinite(num)) {
      throw new BadRequestException(`Invalid rate: ${rate}`);
    }
    return Math.round((num + Number.EPSILON) * RATE_FACTOR) / RATE_FACTOR;
  }

  /**
   * Exact addition of two or more major currency numbers.
   */
  static add(...amounts: (number | string)[]): number {
    const totalMinor = amounts.reduce<number>((sum, val) => sum + Money.toMinor(val), 0);
    return Money.fromMinor(totalMinor);
  }

  /**
   * Exact subtraction: a - b.
   */
  static subtract(a: number | string, b: number | string): number {
    return Money.fromMinor(Money.toMinor(a) - Money.toMinor(b));
  }

  /**
   * Multiply a major currency amount by a quantity or factor and round to 2 decimal places.
   */
  static multiply(amount: number | string, factor: number | string): number {
    const minor = Money.toMinor(amount);
    const f = typeof factor === "string" ? Number(factor) : factor;
    if (!Number.isFinite(f)) {
      throw new BadRequestException(`Invalid multiplication factor: ${factor}`);
    }
    const scaledFactor = Math.round((f + Number.EPSILON) * RATE_FACTOR);
    const resultMinor = Math.round((minor * scaledFactor) / RATE_FACTOR);
    return Money.fromMinor(resultMinor);
  }

  /**
   * Divide a major currency amount by a divisor and round to 2 decimal places.
   */
  static divide(amount: number | string, divisor: number): number {
    if (!Number.isFinite(divisor) || divisor === 0) {
      throw new BadRequestException(`Invalid division divisor: ${divisor}`);
    }
    const minor = Money.toMinor(amount);
    const resultMinor = Math.round((minor + Number.EPSILON) / divisor);
    return Money.fromMinor(resultMinor);
  }

  /**
   * Convert an amount using an exchange rate (e.g. SAR to EGP: amountInSar * sarToEgpRate).
   */
  static convert(amount: number | string, exchangeRate: number | string): number {
    return Money.multiply(amount, Money.roundRate(exchangeRate));
  }

  /**
   * Compare two monetary amounts for equality at 2-decimal precision.
   */
  static equals(a: number | string, b: number | string): boolean {
    return Money.toMinor(a) === Money.toMinor(b);
  }
}
