import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/delivery';
import { onAuthStateChange } from '../services/authService';

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen to Firebase Auth state changes
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      setIsLoading(false);
      
      // Update localStorage for compatibility
      if (user) {
        localStorage.setItem('cornerstone_current_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('cornerstone_current_user');
      }
    });

    return () => unsubscribe();
  }, []);

  const login = (user: User) => {
    setUser(user);
    localStorage.setItem('cornerstone_current_user', JSON.stringify(user));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('cornerstone_current_user');
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated: !!user,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
};