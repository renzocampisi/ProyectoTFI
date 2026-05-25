// src/shared/hooks/useAuth.jsx
/**
 * Context global de autenticación basado en Supabase Auth.
 *
 * Provee { user, loading, signIn, signOut } a toda la app vía <AuthProvider>.
 *
 * Flujo:
 * 1. Al montar, lee la sesión actual con getSession() (sincroniza con localStorage).
 * 2. Se suscribe a onAuthStateChange para mantener `user` reactivo si la
 *    sesión cambia en otra pestaña/tab.
 * 3. Desuscribe en el cleanup del useEffect.
 *
 * `loading` es true SOLO durante la primera carga — sirve para mostrar
 * un spinner antes de decidir si redirigir a /login o mostrar la app.
 *
 * El hook useAuth() lanza si se usa fuera del provider — guard explícito.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@shared/utils/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Sesión activa al montar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
