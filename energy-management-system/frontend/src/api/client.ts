import { AuthResponse, Device, DeviceHourlyHistoryResponse, User } from "../types";

const API_BASE = "";

function getToken(): string | null {
  return localStorage.getItem("ems_token");
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem("ems_token");
    localStorage.removeItem("ems_user");
    if (!window.location.pathname.includes("/login")) {
      window.location.href = "/login";
    }
  }

  if (!response.ok) {
    let errorMessage = "An unexpected error occurred";
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || JSON.stringify(errorData);
    } catch {
      errorMessage = `Server error: ${response.status} ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const authApi = {
  login: (data: { username: string; password: string }) =>
    request<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  register: (data: {
    username: string;
    password: string;
    role?: string;
    email?: string;
    full_name?: string;
    address?: string;
  }) =>
    request<AuthResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  impersonate: (userId: string) =>
    request<AuthResponse>(`/api/v1/auth/impersonate/${userId}`, {
      method: "POST",
    }),
};

export const usersApi = {
  getAll: () => request<User[]>("/api/v1/users"),
  getMe: () => request<User>("/api/v1/users/me"),
  updateMe: (data: Partial<User> & { password?: string }) =>
    request<User>("/api/v1/users/me", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getById: (id: string) => request<User>(`/api/v1/users/${id}`),
  create: (data: Partial<User> & { password: string }) =>
    request<User>("/api/v1/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<User> & { password?: string }) =>
    request<User>(`/api/v1/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ message: string }>(`/api/v1/users/${id}`, {
      method: "DELETE",
    }),
};

export const devicesApi = {
  getAll: () => request<Device[]>("/api/v1/devices"),
  getMyDevices: () => request<Device[]>("/api/v1/devices/my-devices"),
  getById: (id: string) => request<Device>(`/api/v1/devices/${id}`),
  create: (data: Partial<Device>) =>
    request<Device>("/api/v1/devices", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Device>) =>
    request<Device>(`/api/v1/devices/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ message: string }>(`/api/v1/devices/${id}`, {
      method: "DELETE",
    }),
  assign: (deviceId: string, userId: string) =>
    request<Device>(`/api/v1/devices/${deviceId}/assign`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    }),
  unassign: (deviceId: string) =>
    request<Device>(`/api/v1/devices/${deviceId}/unassign`, {
      method: "POST",
    }),
};

export const monitoringApi = {
  getHourlyHistory: (deviceId: string, date?: string) => {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    return request<DeviceHourlyHistoryResponse>(
      `/api/v1/monitoring/devices/${deviceId}/hourly${query}`
    );
  },
};


