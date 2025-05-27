import React, { createContext, useState, useContext, ReactNode } from 'react';

export type CaseStatus = "立案" | "公告" | "债权申报" | "第一次债权人会议" | "其他阶段"; // Added '其他阶段' for more general testing

interface CaseStatusContextType {
  caseStatus: CaseStatus;
  setCaseStatus: (status: CaseStatus) => void;
}

const CaseStatusContext = createContext<CaseStatusContextType | undefined>(undefined);

export const CaseStatusProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [caseStatus, setCaseStatus] = useState<CaseStatus>("债权申报"); // Default to "债权申报" for initial access

  return (
    <CaseStatusContext.Provider value={{ caseStatus, setCaseStatus }}>
      {children}
    </CaseStatusContext.Provider>
  );
};

export const useCaseStatus = (): CaseStatusContextType => {
  const context = useContext(CaseStatusContext);
  if (!context) {
    throw new Error('useCaseStatus must be used within a CaseStatusProvider');
  }
  return context;
};
