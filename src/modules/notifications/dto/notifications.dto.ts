import { z } from "zod";
import { LanguageEnum } from "../../../common/enum";
import { notificationQueryValidator } from "../notifications.validation";

export type NotificationQueryDto = z.infer<ReturnType<typeof notificationQueryValidator>["shape"]["query"]>;
export type NotificationValidationLanguage = LanguageEnum;
