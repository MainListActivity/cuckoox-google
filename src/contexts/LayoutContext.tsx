import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface LayoutContextType {
  // 菜单状态
  isMenuCollapsed: boolean;
  setMenuCollapsed: (collapsed: boolean) => void;
  toggleMenu: () => void;
  
  // 文档中心模式
  isDocumentCenterMode: boolean;
  setDocumentCenterMode: (enabled: boolean) => void;
  
  // 临时菜单展开（文档模式下的临时访问）
  isTemporaryMenuOpen: boolean;
  setTemporaryMenuOpen: (open: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const useLayout = (): LayoutContextType => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};

interface LayoutProviderProps {
  children: ReactNode;
}

// 定义需要启用文档中心模式的路由路径
const DOCUMENT_CENTER_ROUTES = [
  /^\/cases\/[^/]+$/, // 案件详情页面 /cases/:id
  /^\/claims\/[^/]+\/attachment$/, // 债权申报附件页面 /claims/:id/attachment
  /^\/meetings\/[^/]+\/minutes$/, // 会议纪要页面 /meetings/:id/minutes
];

// 检查当前路径是否需要文档中心模式
const isDocumentCenterRoute = (pathname: string): boolean => {
  return DOCUMENT_CENTER_ROUTES.some(pattern => pattern.test(pathname));
};

export const LayoutProvider: React.FC<LayoutProviderProps> = ({ children }) => {
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false);
  const [isDocumentCenterMode, setIsDocumentCenterMode] = useState(false);
  const [isTemporaryMenuOpen, setIsTemporaryMenuOpen] = useState(false);
  const location = useLocation();

  // 监听路由变化，自动切换文档中心模式
  useEffect(() => {
    const shouldEnableDocumentCenter = isDocumentCenterRoute(location.pathname);
    setIsDocumentCenterMode(shouldEnableDocumentCenter);
    
    // 如果进入文档中心模式，默认收起菜单但允许临时展开
    if (shouldEnableDocumentCenter) {
      setIsMenuCollapsed(true);
      setIsTemporaryMenuOpen(false);
    }
  }, [location.pathname]);

  // 在文档中心模式下，关闭临时菜单时恢复收起状态
  useEffect(() => {
    if (isDocumentCenterMode && !isTemporaryMenuOpen) {
      setIsMenuCollapsed(true);
    }
  }, [isDocumentCenterMode, isTemporaryMenuOpen]);

  const setMenuCollapsed = (collapsed: boolean) => {
    setIsMenuCollapsed(collapsed);
    // 在文档中心模式下，如果手动收起菜单，也关闭临时展开状态
    if (isDocumentCenterMode && collapsed) {
      setIsTemporaryMenuOpen(false);
    }
  };

  const toggleMenu = () => {
    if (isDocumentCenterMode) {
      // 在文档中心模式下，切换临时菜单展开状态
      const newTemporaryOpen = !isTemporaryMenuOpen;
      setIsTemporaryMenuOpen(newTemporaryOpen);
      setIsMenuCollapsed(!newTemporaryOpen);
    } else {
      // 在普通模式下，正常切换菜单状态
      setIsMenuCollapsed(!isMenuCollapsed);
    }
  };

  const value: LayoutContextType = {
    isMenuCollapsed,
    setMenuCollapsed,
    toggleMenu,
    isDocumentCenterMode,
    setDocumentCenterMode: setIsDocumentCenterMode,
    isTemporaryMenuOpen,
    setTemporaryMenuOpen: setIsTemporaryMenuOpen,
  };

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
};

export default LayoutContext; 