import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Allowed credentials (as requested)
const ALLOWED_EMAIL = 'nilesh@patil.io';
const ALLOWED_PASSWORD = 'Secret1';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Restore auth from localStorage on app load
  useEffect(() => {
    try {
      const stored = localStorage.getItem('auth_user');
      if (stored) {
        const parsed: User = JSON.parse(stored);
        setUser(parsed);
      }
    } catch {
      console.warn('Failed to parse stored auth user');
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Simple auth check against provided credentials
    if (email.trim().toLowerCase() === ALLOWED_EMAIL && password === ALLOWED_PASSWORD) {
      const authedUser: User = {
        id: 'nilesh-1',
        name: 'Nilesh Patil',
        email: ALLOWED_EMAIL,
        role: 'Admin',
      };
      setUser(authedUser);
      localStorage.setItem('auth_user', JSON.stringify(authedUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}