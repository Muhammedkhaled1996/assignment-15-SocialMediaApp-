import { resolve } from "node:path";
import { config } from "dotenv";
export const NODE_ENV = process.env.NODE_ENV ?? "development";
config({ path: resolve(`.env.${NODE_ENV}`) });

// DB connfigration (mongodb , redis)
export const PORT : number = parseInt(process.env.PORT ?? "9000");
export const DB_URI : string = process.env.DB_URI as string;
export const REDIS_URI : string = process.env.REDIS_URI as string;

// encyraption configration
export const ENC_KEY : string = process.env.ENC_KEY as string;
export const IV_LENGTH : number = parseInt(process.env.IV_LENGTH ?? "16");

// token configration
export const ACCESS_TOKEN_EXPIRES_IN : number = parseInt(process.env.ACCESS_TOKEN_EXPIRES_IN ?? "900");
export const ACCESS_USER_TOKEN_SIGNATURE : string = process.env.ACCESS_USER_TOKEN_SIGNATURE as string;
export const ACCESS_SYSTEM_TOKEN_SIGNATURE : string = process.env.ACCESS_SYSTEM_TOKEN_SIGNATURE as string;
export const REFRESH_TOKEN_EXPIRES_IN : number = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN ?? "30758400");
export const REFRESH_USER_TOKEN_SIGNATURE : string = process.env.REFRESH_USER_TOKEN_SIGNATURE as string;
export const REFRESH_SYSTEM_TOKEN_SIGNATURE : string = process.env.REFRESH_SYSTEM_TOKEN_SIGNATURE as string;

// sigin with google configration client id
export const WEB_CLIENT_IDS : string[] = process.env.WEB_CLIENT_IDS ? process.env.WEB_CLIENT_IDS.split(",") : [];

// mail configration
export const APP_PASSWORD : string = process.env.APP_PASSWORD as string;
export const APP_EMAIL : string = process.env.APP_EMAIL as string;

// app name
export const APPLICATIION_NAME : string = process.env.APPLICATIION_NAME as string;

// allowed origins to access backend apis
export const ORIGINS : string = process.env.ORIGINS as string;
