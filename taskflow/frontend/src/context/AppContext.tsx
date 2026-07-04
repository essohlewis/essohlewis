"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

type User = {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  role: 'user' | 'admin';
  active_modules?: string[] | null;
  profile_type?: string | null;
};

type Workspace = {
  id: number | 'personal';
  name: string;
  role?: string;
};

type Tenant = {
  id: number;
  name: string;
  slug: string;
  plan: string;
  role?: string;
};

type Task = {
  id: number;
  title: string;
  description: string;
  status: 'a_faire' | 'en_cours' | 'terminee';
  priority: 'basse' | 'moyenne' | 'haute';
  tag: string | null;
  due_date: string | null;
  workspace_id: number | null;
  is_archived: boolean;
};

type AppContextType = {
  token: string | null;
  refreshToken: string | null;
  currentUser: User | null;
  currentWorkspace: Workspace;
  currentView: string;
  theme: 'light' | 'dark';
  tasks: Task[];
  currentTenant: Tenant | null;
  tenants: Tenant[];
  activeModules: string[];
  profileType: string;
  login: (token: string, refresh: string, user: User) => void;
  logout: () => void;
  setWorkspace: (ws: Workspace) => void;
  setTenant: (tenant: Tenant | null) => void;
  setCurrentView: (view: string) => void;
  toggleTheme: () => void;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  refreshTasks: () => Promise<void>;
  refreshTenants: () => Promise<void>;
  updateActiveModules: (modules: string[]) => Promise<void>;
  updateProfileType: (profile: string) => Promise<void>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentWorkspace, setWorkspaceState] = useState<Workspace>({ id: 'personal', name: 'Tâches personnelles' });
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeModules, setActiveModules] = useState<string[]>([]);
  const [profileType, setProfileType] = useState<string>('default');

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('taskflow_token');
    const savedRefresh = localStorage.getItem('taskflow_refresh');
    const savedUser = localStorage.getItem('taskflow_user');
    const savedTheme = localStorage.getItem('taskflow_theme') as 'light' | 'dark' | null;
    const savedTenant = localStorage.getItem('taskflow_tenant');

    if (savedToken) setToken(savedToken);
    if (savedRefresh) setRefreshToken(savedRefresh);
    if (savedUser) {
      const u = JSON.parse(savedUser) as User;
      setCurrentUser(u);
      setActiveModules(u.active_modules || []);
      setProfileType(u.profile_type || 'default');
    }
    if (savedTenant) setCurrentTenant(JSON.parse(savedTenant));
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  const login = (newToken: string, newRefresh: string, user: User) => {
    localStorage.setItem('taskflow_token', newToken);
    localStorage.setItem('taskflow_refresh', newRefresh);
    localStorage.setItem('taskflow_user', JSON.stringify(user));
    setToken(newToken);
    setRefreshToken(newRefresh);
    setCurrentUser(user);
    setActiveModules(user.active_modules || []);
    setProfileType(user.profile_type || 'default');
    setCurrentView('dashboard');
  };

  const logout = () => {
    localStorage.removeItem('taskflow_token');
    localStorage.removeItem('taskflow_refresh');
    localStorage.removeItem('taskflow_user');
    localStorage.removeItem('taskflow_workspace_id');
    localStorage.removeItem('taskflow_tenant');
    setToken(null);
    setRefreshToken(null);
    setCurrentUser(null);
    setCurrentTenant(null);
    setTenants([]);
    setTasks([]);
    setActiveModules([]);
    setProfileType('default');
    setCurrentView('dashboard');
  };

  const setWorkspace = (ws: Workspace) => {
    localStorage.setItem('taskflow_workspace_id', String(ws.id));
    setWorkspaceState(ws);
  };

  const setTenant = (tenant: Tenant | null) => {
    if (tenant) {
      localStorage.setItem('taskflow_tenant', JSON.stringify(tenant));
    } else {
      localStorage.removeItem('taskflow_tenant');
    }
    setCurrentTenant(tenant);
    // Reset workspace to personal when tenant changes
    setWorkspaceState({ id: 'personal', name: 'Tâches personnelles' });
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('taskflow_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const refreshTenants = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/tenants/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
      }
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    }
  };

  const refreshTasks = async () => {
    if (!token) return;
    try {
      const url = new URL('/api/tasks', window.location.origin);
      if (currentWorkspace.id !== 'personal') {
        url.searchParams.set('workspaceId', String(currentWorkspace.id));
      }
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (currentTenant) {
        headers['X-Tenant-Id'] = String(currentTenant.id);
        headers['X-Tenant-Slug'] = currentTenant.slug;
      }
      const res = await fetch(url.toString(), { headers });
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  };

  const updateActiveModules = async (modules: string[]) => {
    if (!token) return;
    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ active_modules: modules })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
        localStorage.setItem('taskflow_user', JSON.stringify(data));
        setActiveModules(data.active_modules || []);
      }
    } catch (err) {
      console.error('Failed to update active modules:', err);
    }
  };

  const updateProfileType = async (profile: string) => {
    if (!token) return;
    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ profile_type: profile })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
        localStorage.setItem('taskflow_user', JSON.stringify(data));
        setProfileType(data.profile_type || 'default');
      }
    } catch (err) {
      console.error('Failed to update profile type:', err);
    }
  };

  // Fetch tenants, tasks and user details on change
  useEffect(() => {
    if (token) {
      refreshTenants();
      refreshTasks();
      
      // Fetch latest profile details (such as updated modules)
      fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setCurrentUser(data);
          localStorage.setItem('taskflow_user', JSON.stringify(data));
          setActiveModules(data.active_modules || []);
          setProfileType(data.profile_type || 'default');
        }
      })
      .catch(() => {});
    }
  }, [token, currentWorkspace.id, currentTenant]);

  return (
    <AppContext.Provider value={{
      token,
      refreshToken,
      currentUser,
      currentWorkspace,
      currentView,
      theme,
      tasks,
      currentTenant,
      tenants,
      activeModules,
      profileType,
      login,
      logout,
      setWorkspace,
      setTenant,
      setCurrentView,
      toggleTheme,
      setTasks,
      refreshTasks,
      refreshTenants,
      updateActiveModules,
      updateProfileType
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
