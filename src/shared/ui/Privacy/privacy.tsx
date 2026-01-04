'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/ui/Alert/alert';
import { useTranslation } from '@/shared/hooks/useTranslation';

interface PrivacyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const Privacy: React.FC<PrivacyProps> = ({ open, onOpenChange }) => {
  const t = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Privacy Policy')}</DialogTitle>
          <DialogDescription className="mt-2">
            {t('Privacy Policy Description')}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4 text-sm text-gray-700">
          <div>
            <h3 className="font-semibold text-base mb-2">{t('Privacy Section 1 Title')}</h3>
            <p>{t('Privacy Section 1 Content')}</p>
          </div>
          <div>
            <h3 className="font-semibold text-base mb-2">{t('Privacy Section 2 Title')}</h3>
            <p>{t('Privacy Section 2 Content')}</p>
          </div>
          <div>
            <h3 className="font-semibold text-base mb-2">{t('Privacy Section 3 Title')}</h3>
            <p>{t('Privacy Section 3 Content')}</p>
          </div>
          <div>
            <h3 className="font-semibold text-base mb-2">{t('Privacy Section 4 Title')}</h3>
            <p>{t('Privacy Section 4 Content')}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Privacy;

