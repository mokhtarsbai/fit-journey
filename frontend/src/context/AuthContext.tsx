import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
  bio?: string;
  phone?: string;
  city?: string;
  disciplines: string[];
  hourly_rate?: number;
  rating: number;
  total_reviews: number;
  credits: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionToken: string | null;
  login: () => void;
  logout: () => Promise<void>;
  exchangeSession: (sessionId: string) => Promise<boolean>;
  refreshUser: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const storedToken = await AsyncStorage.getItem('session_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${storedToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setSessionToken(storedToken);
      } else if (response.status === 401) {
        // Access token expiré — tentative de refresh avant déconnexion
        const storedRefreshToken = await AsyncStorage.getItem('refresh_token');
        let refreshed = false;
        if (storedRefreshToken) {
          const refreshResponse = await fetch(`${API_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: storedRefreshToken }),
          });
          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            await AsyncStorage.setItem('session_token', refreshData.access_token);
            await AsyncStorage.setItem('refresh_token', refreshData.refresh_token);
            setSessionToken(refreshData.access_token);
            const userResponse = await fetch(`${API_URL}/api/auth/me`, {
              headers: { 'Authorization': `Bearer ${refreshData.access_token}` },
            });
            if (userResponse.ok) {
              setUser(await userResponse.json());
              refreshed = true;
            }
          }
        }
        if (!refreshed) {
          await AsyncStorage.multiRemove(['session_token', 'refresh_token']);
          setSessionToken(null);
          setUser(null);
        }
      } else {
        await AsyncStorage.multiRemove(['session_token', 'refresh_token']);
        setSessionToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = Platform.OS === 'web'
      ? `${window.location.origin}/auth/callback`
      : `${API_URL}/auth/callback`;
    
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    
    if (Platform.OS === 'web') {
      window.location.href = authUrl;
    } else {
      // For mobile, we'll use expo-web-browser
      const { openBrowserAsync } = require('expo-web-browser');
      openBrowserAsync(authUrl);
    }
  };

  const exchangeSession = async (sessionId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/api/auth/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (response.ok) {
        const data = await response.json();
        await AsyncStorage.setItem('session_token', data.session_token);
        await AsyncStorage.setItem('refresh_token', data.refresh_token);
        setSessionToken(data.session_token);
        setUser(data.user);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Session exchange error:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      if (sessionToken) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await AsyncStorage.multiRemove(['session_token', 'refresh_token']);
      setSessionToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    if (!sessionToken) return;
    
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  };

  const updateUser = async (data: Partial<User>) => {
    if (!sessionToken) return;

    try {
      const response = await fetch(`${API_URL}/api/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Update user error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        sessionToken,
        login,
        logout,
        exchangeSession,
        refreshUser,
        updateUser,
      }}
    >
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
