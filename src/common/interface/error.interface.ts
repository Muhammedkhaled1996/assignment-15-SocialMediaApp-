export interface IError extends Error {
  status?: number;
  code?: string;
  cause?: unknown;
  keyValue?: Record<string, unknown>;
}
