import { getTheme, setTheme } from './storage.js';

export function applyTheme(){document.documentElement.dataset.theme=getTheme()}
export function toggleTheme(){const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;setTheme(next)}
