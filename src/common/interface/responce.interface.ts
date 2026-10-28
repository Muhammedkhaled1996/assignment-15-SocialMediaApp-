export interface IResponse<T = undefined, Z = undefined> {
  message?: boolean;
  data?: T;
  extra?: Z;
  status?: number;
}
