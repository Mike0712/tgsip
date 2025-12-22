import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface AlertState {
  open: boolean;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
}

interface AlertContextType {
  alert: AlertState;
  showAlert: (title: string, description?: string, variant?: 'default' | 'success' | 'error' | 'warning') => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return context;
};

interface AlertProviderProps {
  children: ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [alert, setAlert] = useState<AlertState>({
    open: false,
    title: '',
    description: '',
    variant: 'default',
  });

  const showAlert = useCallback((
    title: string,
    description?: string,
    variant: 'default' | 'success' | 'error' | 'warning' = 'default'
  ) => {
    setAlert({
      open: true,
      title,
      description,
      variant,
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlert(prev => ({ ...prev, open: false }));
  }, []);

  return (
    <AlertContext.Provider value={{ alert, showAlert, hideAlert }}>
      {children}
    </AlertContext.Provider>
  );
};

