export interface Timestamp {
  createdAt: string;
  updatedAt: string;
}

export interface BaseEntity extends Timestamp {
  id: string;
}

export type SortOrder = 'asc' | 'desc';

export interface SearchQuery {
  query?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface SelectOption {
  label: string;
  value: string;
}

export type Status = 'active' | 'inactive' | 'pending' | 'archived';
