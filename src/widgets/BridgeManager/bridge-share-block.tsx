'use client';

import React from 'react';
import { useAlert } from '@/shared/lib/hooks/useAlert';
import { DeepLinkShare } from '@/features/DeepLinkShare/ui/deep-link-share';

interface BridgeShareBlockProps {
  deepLink: string | null;
  appLink: string | null;
}

export const BridgeShareBlock: React.FC<BridgeShareBlockProps> = ({ deepLink, appLink }) => {
  const { showAlert } = useAlert();

  const handleCopy = (value: string, message: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      showAlert('Ссылка скопирована', message, 'success');
    }).catch(() => {
      showAlert('Ошибка', 'Не удалось скопировать ссылку', 'error');
    });
  };

  if (!deepLink && !appLink) {
    return null;
  }

  return (
    <>
      {deepLink && <DeepLinkShare deepLink={deepLink} />}

      {appLink && process.env.NODE_ENV !== 'production' && (
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Прямая ссылка на MiniPhone:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={appLink}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
            />
            <button
              onClick={() => handleCopy(appLink, 'Ссылка на MiniPhone скопирована')}
              className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
            >
              Копировать
            </button>
          </div>
        </div>
      )}
    </>
  );
};

