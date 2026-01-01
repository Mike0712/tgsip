# Тестирование - MiniPhone

## 📋 Обзор

Проект использует Jest и React Testing Library для unit-тестирования frontend компонентов. Тесты размещаются рядом с компонентами, которые они тестируют.

## 🚀 Быстрый старт

### 1. Установка зависимостей

Зависимости для тестирования уже добавлены в `package.json`. Установите их:

```bash
npm install
```

### 2. Запуск тестов

```bash
# Запуск всех тестов
npm test

# Запуск в watch режиме (автоматический перезапуск при изменениях)
npm run test:watch

# Запуск с покрытием кода
npm run test:coverage
```

## 📁 Структура тестов

Тесты размещаются рядом с компонентами, которые они тестируют:

```
src/
  widgets/
    MiniPhone/
      ui/
        mini-phone-screen.tsx
        mini-phone-screen.test.tsx  ← тест рядом с компонентом
```

**Паттерны именования тестовых файлов:**
- `*.test.tsx` или `*.test.ts`
- `*.spec.tsx` или `*.spec.ts`
- Файлы в папке `__tests__/`

## 🛠️ Конфигурация

### Jest Config (`jest.config.js`)

- Использует `next/jest` для интеграции с Next.js
- Поддерживает TypeScript и пути `@/*`
- Настроен для работы с jsdom окружением
- Автоматически находит тесты по паттернам

### Setup файл (`jest.setup.js`)

Содержит:
- Импорт `@testing-library/jest-dom` для дополнительных матчеров
- Моки для Next.js router и navigation
- Моки для браузерных API (matchMedia, IntersectionObserver)

## 📝 Написание тестов

### Базовый пример

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './my-component';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    const mockHandler = jest.fn();
    
    render(<MyComponent onClick={mockHandler} />);
    
    await user.click(screen.getByRole('button'));
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });
});
```

### Тестирование компонентов с Redux

Используйте утилиту `renderWithRedux` из `@/shared/lib/test-utils`:

```tsx
import { renderWithRedux } from '@/shared/lib/test-utils';
import { MyReduxComponent } from './my-redux-component';

describe('MyReduxComponent', () => {
  it('renders with initial state', () => {
    const preloadedState = {
      sip: {
        sessionState: 'Established',
        // ... другие поля
      },
    };

    const { store } = renderWithRedux(
      <MyReduxComponent />,
      { preloadedState }
    );

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });
});
```

### Тестирование хуков

Для тестирования кастомных хуков используйте `@testing-library/react-hooks` или оберните в тестовый компонент:

```tsx
import { renderHook, act } from '@testing-library/react';
import { useMyHook } from './use-my-hook';

describe('useMyHook', () => {
  it('returns initial value', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.value).toBe(0);
  });

  it('updates value on action', () => {
    const { result } = renderHook(() => useMyHook());
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.value).toBe(1);
  });
});
```

## 🎯 Best Practices

### 1. Тестируйте поведение, а не реализацию

❌ Плохо:
```tsx
expect(component.state.isOpen).toBe(true);
```

✅ Хорошо:
```tsx
expect(screen.getByRole('dialog')).toBeInTheDocument();
```

### 2. Используйте семантические селекторы

❌ Плохо:
```tsx
screen.getByTestId('submit-button');
```

✅ Хорошо:
```tsx
screen.getByRole('button', { name: /submit/i });
```

### 3. Тестируйте пользовательские сценарии

```tsx
it('allows user to complete form submission', async () => {
  const user = userEvent.setup();
  
  render(<Form />);
  
  await user.type(screen.getByLabelText('Email'), 'test@example.com');
  await user.type(screen.getByLabelText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: /submit/i }));
  
  await waitFor(() => {
    expect(screen.getByText('Success')).toBeInTheDocument();
  });
});
```

### 4. Изолируйте тесты

```tsx
describe('Component', () => {
  beforeEach(() => {
    // Сброс моков перед каждым тестом
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Очистка после теста
    cleanup();
  });
});
```

### 5. Мокируйте внешние зависимости

```tsx
// Мок для API вызовов
jest.mock('@/lib/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Мок для Next.js модулей
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/',
  }),
}));
```

## 🔧 Утилиты для тестирования

### `src/shared/lib/test-utils.tsx`

Содержит:
- `renderWithRedux` - обертка для рендеринга с Redux Provider
- Экспорт всех функций из `@testing-library/react`

**Использование:**

```tsx
import { renderWithRedux, screen } from '@/shared/lib/test-utils';
```

## 📊 Покрытие кода

Запуск с покрытием:

```bash
npm run test:coverage
```

Результаты сохраняются в папке `coverage/`. Откройте `coverage/lcov-report/index.html` в браузере для просмотра детального отчета.

**Настройка покрытия** в `jest.config.js`:
- Исключает типы (`.d.ts`)
- Исключает stories файлы
- Исключает папки с тестами и моками

## 🐛 Отладка тестов

### Вывод DOM в консоль

```tsx
import { screen } from '@testing-library/react';

screen.debug(); // Выводит весь DOM
screen.debug(screen.getByRole('button')); // Выводит конкретный элемент
```

### Логирование queries

```tsx
import { logRoles } from '@testing-library/react';

const { container } = render(<MyComponent />);
logRoles(container);
```

### Запуск одного теста

```bash
npm test -- MyComponent.test.tsx
npm test -- -t "renders correctly"
```

## 📚 Полезные ресурсы

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library User Event](https://testing-library.com/docs/user-event/intro/)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)

## 🎓 Примеры в проекте

Смотрите примеры тестов:
- `src/widgets/MiniPhone/ui/mini-phone-screen.test.tsx` - пример тестирования компонента

## ⚠️ Частые проблемы

### Проблема: "Cannot find module '@/...'"

**Решение:** Убедитесь, что `moduleNameMapper` в `jest.config.js` правильно настроен для путей `@/*`.

### Проблема: "useRouter is not a function"

**Решение:** Мок для `next/navigation` уже настроен в `jest.setup.js`. Если проблема сохраняется, проверьте импорты.

### Проблема: "Cannot use import statement outside a module" (sip.js)

**Решение:** Мок для `sip.js` уже настроен в `__mocks__/sip.js` и подключен через `moduleNameMapper`. Это решает проблему с ES модулями в `sip.js`. Если нужно расширить мок, отредактируйте `__mocks__/sip.js`.

### Проблема: "window.matchMedia is not a function"

**Решение:** Мок уже настроен в `jest.setup.js`. Если нужно кастомизировать, добавьте в тест:

```tsx
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
```


