export type ApiResponse<T> = {
  status: 'success' | 'error';
  data: T;
  message?: string;
};

export type PaginatedResponse<T> = ApiResponse<{
  items: T[];
  total: number;
}>;
