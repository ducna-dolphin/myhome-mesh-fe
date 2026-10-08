import { createContext } from 'react';
import type { SuperAppClient } from './super-app-client';

export const SuperAppContext = createContext<SuperAppClient | null>(null);
