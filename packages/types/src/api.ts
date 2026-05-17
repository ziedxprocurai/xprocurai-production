export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  statusCode: number;
}

export interface ApiErrorResponse {
  message: string;
  error: string;
  statusCode: number;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
