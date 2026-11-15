import { z } from "zod";
import { LanguageEnum } from "../../../common/enum";
import { upsertSettingValidator } from "../settings.validation";

export type UpsertSettingDto = z.infer<ReturnType<typeof upsertSettingValidator>["shape"]["body"]>;
export type SettingsValidationLanguage = LanguageEnum;
