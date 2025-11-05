"use client";
import React from "react";

type Props = React.PropsWithChildren<{
  onError?: (error: unknown, info?: unknown) => void;
}>;

class ErrorBoundary extends React.Component<Props, { hasError: boolean }> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Basic client-side reporting without adding new deps
    // eslint-disable-next-line no-console
    console.error("Client error captured", error, info);
    this.props.onError?.(error, info);
  }

  render() {
    return this.props.children as React.ReactNode;
  }
}

export function ObservabilityProvider({ children, onError }: Props) {
  return <ErrorBoundary onError={onError}>{children}</ErrorBoundary>;
}