import { useState, useEffect } from "react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-sm border-b border-[#E2E8F0]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center bg-[#059669] rounded-lg">
            <i className="ri-shield-check-line text-white text-sm"></i>
          </div>
          <span className="font-semibold text-[#0F172A] text-base tracking-tight">İSGPanel</span>
        </div>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-8">
          {[
            { label: "Özellikler", href: "#ozellikler" },
            { label: "Nasıl Çalışır", href: "#nasil-calisir" },
            { label: "Panel", href: "#panel" },
            { label: "Avantajlar", href: "#avantajlar" },
            { label: "İletişim", href: "#iletisim" },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer whitespace-nowrap"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <a
          href="#"
          className="hidden md:inline-flex items-center gap-2 bg-[#059669] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#047857] transition-colors cursor-pointer whitespace-nowrap"
        >
          Panele Giriş Yap
          <i className="ri-arrow-right-line text-xs"></i>
        </a>

        {/* Mobile hamburger */}
        <button className="md:hidden w-8 h-8 flex items-center justify-center text-[#334155] cursor-pointer">
          <i className="ri-menu-line text-lg"></i>
        </button>
      </div>
    </header>
  );
}
