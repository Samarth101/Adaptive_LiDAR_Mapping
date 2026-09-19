'use client';
import { createContext, useContext } from 'react';

export const DocsAnimationContext = createContext({ isPaused: false });

export const useDocsAnimation = () => useContext(DocsAnimationContext);
