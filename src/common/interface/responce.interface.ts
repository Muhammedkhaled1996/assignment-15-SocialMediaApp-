export interface IResponse<T = undefined, Z = undefined> {
  message?: boolean;
  data?: T;
  extra?: Z;
  status?: number;
}

export interface IResponseUpdate {
  acknowledged: boolean;
  modifiedCount: number;
  upsertedId: null | string;
  upsertedCount: number;
  matchedCount: number;
}

export interface IResponseDelete {
  acknowledged: boolean;
  deletedCount: number;
}
