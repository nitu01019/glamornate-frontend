import React, { useState } from 'react'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-background border-b">
      <nav className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="text-2xl font-bold">Glamornate</div>
        
        <div className="hidden md:flex items-center gap-6">
          <a href="/spas" className="hover:underline">Find Spas</a>
          <a href="/services" className="hover:underline">Services</a>
          <a href="/bookings" className="hover:underline">Bookings</a>
        </div>

        <button 
          className="md:hidden text-2xl"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="menu"
        >
          ☰
        </button>

        <div className="hidden md:block">
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded">Sign In</button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-background border-b p-4">
            <a href="/spas" className="block py-2">Find Spas</a>
            <a href="/services" className="block py-2">Services</a>
            <a href="/bookings" className="block py-2">Bookings</a>
            <button className="w-full py-2 mt-2 bg-primary text-primary-foreground rounded">Sign In</button>
          </div>
        )}
      </nav>
    </header>
  )
}
