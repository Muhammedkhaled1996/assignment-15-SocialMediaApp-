export interface IPagination<T> {
  totalDocs: number;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
  };
  docs: T[];
}