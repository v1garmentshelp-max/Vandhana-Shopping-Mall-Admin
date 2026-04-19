import React, { createContext, useContext, useState, useMemo, useCallback } from 'react'
import LoaderOverlay from './Loader'

const LoadingContext = createContext({ show: () => {}, hide: () => {}, visible: false })

export function LoadingProvider({ children }) {
  const [visible, setVisible] = useState(false)
  const show = useCallback(() => setVisible(true), [])
  const hide = useCallback(() => setVisible(false), [])
  const value = useMemo(() => ({ show, hide, visible }), [show, hide, visible])
  return (
    <LoadingContext.Provider value={value}>
      {children}
      {visible ? <LoaderOverlay /> : null}
    </LoadingContext.Provider>
  )
}

export function useLoading() {
  return useContext(LoadingContext)
}
