export class ApplicationException extends Error {
  public code: string;
  constructor(
    override message: string,
    public status: number,
    override cause?: unknown,
    code?: string,
  ) {
    super();
    this.name = this.constructor.name;
    this.code = code || this.name.replace(/Exception|Error$/, "").toUpperCase() || "APPLICATION_ERROR";
    Error.captureStackTrace(this, this.constructor);
  }
}

