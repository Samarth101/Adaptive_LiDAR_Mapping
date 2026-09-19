'use client';

import { Component, type ReactNode } from 'react';

// Simple ErrorBoundary to catch GLB load failures
export class ErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}
