'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/ui/Alert/alert';
import { useTranslation } from '@/shared/hooks/useTranslation';

interface PrivacyTermsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PrivacyTerms: React.FC<PrivacyTermsProps> = ({ open, onOpenChange }) => {
  const t = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('Privacy Policy')} {t('and')} {t('Terms of Service')}</DialogTitle>
          <DialogDescription className="mt-2">
            {t('Privacy Policy Description')}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4 text-sm text-gray-700 overflow-y-auto flex-1 pr-2">
          {/* Privacy Policy Section */}
          <div>
            <h2 className="font-bold text-lg mb-3">{t('Privacy Policy')}</h2>
            <div className="space-y-4">
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
              <div>
                <h3 className="font-semibold text-base mb-2">{t('Privacy Section 5 Title')}</h3>
                <p>{t('Privacy Section 5 Content')}</p>
              </div>
              <div>
                <h3 className="font-semibold text-base mb-2">{t('Privacy Section 6 Title')}</h3>
                <p>{t('Privacy Section 6 Content')}</p>
              </div>
            </div>
          </div>

          {/* Terms of Service Section */}
          <div className="mt-6">
            <h2 className="font-bold text-lg mb-3">{t('Terms of Service')}</h2>
            <DialogDescription className="mb-3">
              {t('Terms of Service Description')}
            </DialogDescription>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-base mb-2">{t('Terms Section 1 Title')}</h3>
                <p>{t('Terms Section 1 Content')}</p>
              </div>
              <div>
                <h3 className="font-semibold text-base mb-2">{t('Terms Section 2 Title')}</h3>
                <p>{t('Terms Section 2 Content')}</p>
              </div>
              <div>
                <h3 className="font-semibold text-base mb-2">{t('Terms Section 3 Title')}</h3>
                <p>{t('Terms Section 3 Content')}</p>
              </div>
              <div>
                <h3 className="font-semibold text-base mb-2">{t('Terms Section 4 Title')}</h3>
                <p>{t('Terms Section 4 Content')}</p>
              </div>
              <div>
                <h3 className="font-semibold text-base mb-2">{t('Terms Section 5 Title')}</h3>
                <p>{t('Terms Section 5 Content')}</p>
              </div>
              <div>
                <h3 className="font-semibold text-base mb-2">{t('Terms Section 6 Title')}</h3>
                <p>{t('Terms Section 6 Content')}</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrivacyTerms;

