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
  isAuthenticated: boolean;
  isAdmin: boolean;
  isClient: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("ems_token");
    const savedUser = localStorage.getItem("ems_user");

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("ems_token");
        localStorage.removeItem("ems_user");
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
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("ems_token");
    localStorage.removeItem("ems_user");
  };

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

