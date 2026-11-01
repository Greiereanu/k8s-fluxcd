export type UserRole = "ADMIN" | "CLIENT";

export interface User {
  id: string;
  username: string;
  email: string | null;
  full_name: string | null;
  address: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  max_consumption: number;
  assigned_user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  username: string;
  role: UserRole;
}
