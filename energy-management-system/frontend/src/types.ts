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

export interface HourlyConsumptionRecord {
  id: string;
  device_id: string;
  timestamp_hour: string;
  total_consumption: number;
  measurement_count: number;
  alert_sent: boolean;
}

export interface DeviceHourlyHistoryResponse {
  device_id: string;
  max_consumption: number | null;
  records: HourlyConsumptionRecord[];
}

export interface AlertNotification {
  type: string;
  device_id: string;
  device_name: string;
  user_id: string | null;
  hour: string;
  current_consumption: number;
  max_consumption: number;
  timestamp: string;
  message: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_id: string;
  sender_username: string;
  sender_role: "CLIENT" | "ADMIN";
  content: string;
  is_read: boolean;
  timestamp: string;
}

export interface ChatSessionSummary {
  id: string;
  client_user_id: string;
  client_username: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_message: ChatMessage | null;
  unread_count: number;
}

export interface ChatSessionDetail {
  id: string;
  client_user_id: string;
  client_username: string;
  is_active: boolean;
  messages: ChatMessage[];
}



