import React, { createContext, useContext, useState, useEffect } from "react";
import { AuthResponse, UserRole } from "../types";

interface AuthUser {
  userId: string;
  username: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (data: AuthResponse) => void;
  logout: () => void;
  impersonate: (data: AuthResponse) => void;
  stopImpersonation: () => void;
  isImpersonating: boolean;
  originalAdmin: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isClient: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [originalAdmin, setOriginalAdmin] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("ems_token");
    const savedUser = localStorage.getItem("ems_user");
    const savedAdminToken = localStorage.getItem("ems_original_admin_token");
    const savedAdminUser = localStorage.getItem("ems_original_admin_user");

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("ems_token");
        localStorage.removeItem("ems_user");
      }
    }

    if (savedAdminToken && savedAdminUser) {
      try {
        setOriginalAdmin(JSON.parse(savedAdminUser));
      } catch {
        localStorage.removeItem("ems_original_admin_token");
        localStorage.removeItem("ems_original_admin_user");
      }
    }

    setLoading(false);
  }, []);

  const login = (data: AuthResponse) => {
    const authUser: AuthUser = {
      userId: data.user_id,
      username: data.username,
      role: data.role,
    };
    setToken(data.access_token);
    setUser(authUser);
    localStorage.setItem("ems_token", data.access_token);
    localStorage.setItem("ems_user", JSON.stringify(authUser));
    localStorage.removeItem("ems_original_admin_token");
    localStorage.removeItem("ems_original_admin_user");
    setOriginalAdmin(null);
  };

  const impersonate = (data: AuthResponse) => {
    if (!token || !user) return;

    // Backup current admin credentials
    localStorage.setItem("ems_original_admin_token", token);
    localStorage.setItem("ems_original_admin_user", JSON.stringify(user));
    setOriginalAdmin(user);

    // Set target user credentials as active
    const targetUser: AuthUser = {
      userId: data.user_id,
      username: data.username,
      role: data.role,
    };
    setToken(data.access_token);
    setUser(targetUser);
    localStorage.setItem("ems_token", data.access_token);
    localStorage.setItem("ems_user", JSON.stringify(targetUser));
  };

  const stopImpersonation = () => {
    const adminToken = localStorage.getItem("ems_original_admin_token");
    const adminUserJson = localStorage.getItem("ems_original_admin_user");

    if (adminToken && adminUserJson) {
      try {
        const adminUser = JSON.parse(adminUserJson);
        setToken(adminToken);
        setUser(adminUser);
        localStorage.setItem("ems_token", adminToken);
        localStorage.setItem("ems_user", adminUserJson);
      } catch {
        logout();
      }
    }
    localStorage.removeItem("ems_original_admin_token");
    localStorage.removeItem("ems_original_admin_user");
    setOriginalAdmin(null);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setOriginalAdmin(null);
    localStorage.removeItem("ems_token");
    localStorage.removeItem("ems_user");
    localStorage.removeItem("ems_original_admin_token");
    localStorage.removeItem("ems_original_admin_user");
  };

  const isImpersonating = !!originalAdmin;
  const isAuthenticated = !!token && !!user;
  const isAdmin = user?.role === "ADMIN";
  const isClient = user?.role === "CLIENT";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        impersonate,
        stopImpersonation,
        isImpersonating,
        originalAdmin,
        isAuthenticated,
        isAdmin,
        isClient,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
