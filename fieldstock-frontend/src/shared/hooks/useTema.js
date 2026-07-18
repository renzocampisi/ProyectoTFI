// src/shared/hooks/useTema.js
/**
 * Hook de modo claro/oscuro — extraído de AppLayout.jsx para poder
 * reusarlo también en páginas públicas (fuera del layout autenticado,
 * ej. la landing en /bienvenida).
 *
 * Persiste en localStorage bajo 'fs-tema' y aplica el atributo
 * data-theme en <html> (ver src/styles/global.css: el modo oscuro es
 * el default sin atributo, :root[data-theme="light"] sobreescribe).
 */
import { useState, useEffect } from 'react'

export function useTema() {
  const [tema, setTema] = useState(() => localStorage.getItem('fs-tema') || 'dark')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema === 'light' ? 'light' : '')
    localStorage.setItem('fs-tema', tema)
  }, [tema])
  const toggle = () => setTema(t => t === 'dark' ? 'light' : 'dark')
  return { tema, toggle }
}
