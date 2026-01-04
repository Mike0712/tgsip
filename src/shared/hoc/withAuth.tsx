'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/shared/hooks/useAuth';

interface WithAuthOptions {
  redirectTo?: string;
  requireAuth?: boolean;
}

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthOptions = {}
) {
  const { redirectTo = '/signin', requireAuth = true } = options;

  return function AuthenticatedComponent(props: P) {
    const router = useRouter();
    const { isAuthenticated, isLoading } = useAuth();

    useEffect(() => {
      if (!isLoading) {
        if (requireAuth && !isAuthenticated) {
          router.replace(redirectTo);
        } else if (!requireAuth && isAuthenticated) {
          router.replace('/miniphone');
        }
      }
    }, [isAuthenticated, isLoading, router, redirectTo, requireAuth]);

    if (isLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Проверка аутентификации...</p>
          </div>
        </div>
      );
    }

    if (requireAuth && !isAuthenticated) {
      return null; // Редирект произойдет через useEffect
    }

    if (!requireAuth && isAuthenticated) {
      return null; // Редирект произойдет через useEffect
    }

    return <Component {...props} />;
  };
}

