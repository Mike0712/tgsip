import React from 'react';
import { Alert } from '@/shared/ui/Alert/alert';
import { useAlert } from '@/shared/lib/hooks/useAlert';

export const AlertContainer: React.FC = () => {
  const { alert, hideAlert } = useAlert();

  return (
    <Alert
      open={alert.open}
      onOpenChange={hideAlert}
      title={alert.title}
      description={alert.description}
      variant={alert.variant}
    />
  );
};

