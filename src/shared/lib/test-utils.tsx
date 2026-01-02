import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore, PreloadedState } from '@reduxjs/toolkit';
import type { RootState, AppDispatch } from '@/app/store';
import sipReducer from '@/entities/WebRtc/model/slice';

// Создаем функцию для создания тестового store
function createTestStore(preloadedState?: PreloadedState<RootState>) {
  return configureStore({
    reducer: {
      sip: sipReducer,
      // Добавьте другие редьюсеры по мере необходимости
    },
    preloadedState,
  });
}

// Тип для кастомного render с Redux
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: PreloadedState<RootState>;
  store?: ReturnType<typeof createTestStore>;
}

// Кастомный render с Redux Provider
export function renderWithRedux(
  ui: ReactElement,
  {
    preloadedState,
    store = createTestStore(preloadedState),
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

// Re-export все из @testing-library/react
export * from '@testing-library/react';

// Переопределяем render по умолчанию
export { renderWithRedux as render };

