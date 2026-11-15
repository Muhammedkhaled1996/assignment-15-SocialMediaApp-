import { z } from "zod";
import { createFlightValidator } from "../flights.validation";

export type CreateFlightLotDto = z.infer<ReturnType<typeof createFlightValidator>>;
