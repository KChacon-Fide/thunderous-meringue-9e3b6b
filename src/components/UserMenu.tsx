import { useState, useRef, useEffect } from 'react'
import { LogOut, User, Settings, ChevronRight } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

export function UserMenu({
  username,
  initials,
  avatarUrl,
  onSignOut,
}: {
  username: string
  initials: string
  avatarUrl: string | null
  onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="sidebar-user w-full text-left hover:bg-white/5 transition-colors rounded-lg cursor-pointer"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="sidebar-avatar sidebar-avatar-image" />
        ) : (
          <div className="sidebar-avatar">{initials}</div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="sidebar-username">{username}</span>
          <span className="text-xs text-white/30">Gratis</span>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 text-white/30 ml-auto flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#0D1B3E] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0D1B3E] truncate">{username}</p>
                <p className="text-xs text-gray-400">Gratis</p>
              </div>
            </div>
          </div>

          <div className="py-1">
            <button
              onClick={() => { setOpen(false); navigate({ to: '/profile' }) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <User className="w-4 h-4 text-gray-400" />
              Perfil
            </button>
            <button
              onClick={() => { setOpen(false); navigate({ to: '/settings' }) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-4 h-4 text-gray-400" />
              Configuración
            </button>
          </div>

          <div className="border-t border-gray-100 py-1">
            <button
              onClick={() => { setOpen(false); onSignOut() }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
