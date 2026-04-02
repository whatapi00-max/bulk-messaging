import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { getMe, isAuthenticated, logout } from "../lib/auth";
import { connectSocket, disconnectSocket } from "../lib/socket";

interface User {
  id: string;
  email: string;
  fullName: string;
  companyName?: string | null;
  onboardingCompleted: boolean | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }
    try {
      const userData = await getMe();
      setUser(userData);
      connectSocket(userData.id);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
    return () => { disconnectSocket(); };
  }, [fetchUser]);

  return (
    <AuthContext.Provider value={{ user, loading, isLoading: loading, isAuthenticated: !!user, refresh: fetchUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
