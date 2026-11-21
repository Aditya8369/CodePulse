import '@testing-library/jest-dom/vitest';


import { vi } from 'vitest';

// jsdom has no canvas renderer; keep decorative confetti out of component tests.
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
