/// <reference types="vite/client" />

export const API_BASE_URL =
  (import.meta.env?.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ||
  'http://localhost:4000/api/v1';
