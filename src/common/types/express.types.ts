declare module "express-serve-static-core" {
  interface Request {
    validate: any;
    file: any;
    files: any;
  }
}
