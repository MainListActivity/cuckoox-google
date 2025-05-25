import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email?: string;
  role: string; // e.g., 'admin', 'manager', 'creditor'
  // Add other user properties as needed
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  login: (userData: Omit<User, 'id'> & { id?: string } ) => void; // Mock login
  logout: () => void;
  hasRole: (role: string) => boolean;
  // selectedCaseId: string | null; // To be implemented
  // selectCase: (caseId: string) => void; // To be implemented
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check localStorage for persisted login state
    const storedIsLoggedIn = localStorage.getItem('cuckoox-isLoggedIn') === 'true';
    const storedUser = localStorage.getItem('cuckoox-user');
    if (storedIsLoggedIn && storedUser) {
      setIsLoggedIn(true);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = (userData: Omit<User, 'id'> & { id?: string }) => {
    // Simulate API call or OIDC flow for GitHub login
    // For now, mock login:
    const mockUser: User = {
      id: userData.id || `user-${Date.now()}`,
      name: userData.name,
      email: userData.email,
      role: userData.role, // Example role
    };
    setUser(mockUser);
    setIsLoggedIn(true);
    localStorage.setItem('cuckoox-isLoggedIn', 'true');
    localStorage.setItem('cuckoox-user', JSON.stringify(mockUser));
  };

  const logout = () => {
    setUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem('cuckoox-isLoggedIn');
    localStorage.removeItem('cuckoox-user');
    localStorage.removeItem('cuckoox-selectedCaseId'); // Clear selected case on logout
    // Potentially redirect to login page via useNavigate in the component calling logout
  };

  const hasRole = (role: string): boolean => {
    return !!user && user.role === role;
  };
  
  // Placeholder for case selection logic
  // const [selectedCaseId, setSelectedCaseId] = useState<string | null>(localStorage.getItem('cuckoox-selectedCaseId'));
  // const selectCase = (caseId: string) => {
  //   setSelectedCaseId(caseId);
  //   localStorage.setItem('cuckoox-selectedCaseId', caseId);
  // };


  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};