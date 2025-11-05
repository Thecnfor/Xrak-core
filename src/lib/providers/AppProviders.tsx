"use client";
import React from "react";
import { PersistGate } from "./PersistGate";
import { ThemeProvider } from "./ThemeProvider";
import { QueryProvider } from "./QueryProvider";
import { ToasterProvider } from "./ToasterProvider";

export default function AppProviders({ children }: React.PropsWithChildren) {
  return (
    <PersistGate>
      <ThemeProvider>
        <QueryProvider>
          <ToasterProvider>{children}</ToasterProvider>
        </QueryProvider>
      </ThemeProvider>
    </PersistGate>
  );
}