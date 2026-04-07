import { useState } from "react";

const navLinks = [
  { label: "Hakkında", href: "#hero" },
  { label: "Sistem Nedir?", href: "#cozum" },
  { label: "Özellikler", href: "#ozellikler" },
  { label: "Nasıl Çalışır?", href: "#nasil-calisir" },
  { label: "Panel Önizleme", href: "#panel-onizleme" },
];

const legalLinks = [
  { label: "Gizlilik Politikası", href: "#" },
  { label: "Kullanım Koşulları", href: "#" },
  { label: "KVKK Aydınlatma Metni", href: "#" },
];

export default function Footer() {
  const year = new Date().getFullYear();
  const [wpHovered, setWpHovered] = useState(false);

  return (
    <>
      {/* WhatsApp Floating Button */}
      <a
        href="https://wa.me/905000000000"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#25D366] text-white rounded-full shadow-lg transition-all duration-300 cursor-pointer"
        style={{
          padding: wpHovered ? "12px 20px 12px 16px" : "14px",
        }}
        onMouseEnter={() => setWpHovered(true)}
        onMouseLeave={() => setWpHovered(false)}
      >
        <div className="w-6 h-6 flex items-center justify-center shrink-0">
          <i className="ri-whatsapp-line text-white text-xl"></i>
        </div>
        <span
          className="text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300"
          style={{
            maxWidth: wpHovered ? "160px" : "0px",
            opacity: wpHovered ? 1 : 0,
          }}
        >
          WhatsApp ile Yaz
        </span>
      </a>

      <footer className="bg-[#F8FAFC] border-t border-[#E2E8F0] pt-16 pb-8 px-6">
        <div className="max-w-6xl mx-auto">

          {/* Top grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-14">

            {/* Brand */}
            <div className="flex flex-col gap-4 md:col-span-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center bg-[#059669] rounded-lg">
                  <i className="ri-shield-check-line text-white text-sm"></i>
                </div>
                <span className="font-semibold text-[#0F172A] text-base tracking-tight">İSGPanel</span>
              </div>
              <p className="text-sm text-[#64748B] leading-relaxed">
                ISG süreçlerini dijitalleştiren, sahada ve ofiste çalışan ekipler için tasarlanmış yönetim platformu.
              </p>
              <div className="flex items-start gap-3 mt-1">
                <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                  <i className="ri-mail-line text-[#059669] text-sm"></i>
                </div>
                <div>
                  <span className="text-sm text-[#374151]">info@isgdenetim.com.tr</span>
                  <p className="text-xs text-[#94A3B8] mt-0.5">Yakında aktif</p>
                </div>
              </div>
            </div>

            {/* Spacer on md */}
            <div className="hidden md:block" />

            {/* Nav */}
            <div>
              <p className="text-xs font-semibold text-[#0F172A] uppercase tracking-widest mb-5">Menü</p>
              <ul className="flex flex-col gap-3">
                {navLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-[#64748B] hover:text-[#059669] transition-colors cursor-pointer"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="text-xs font-semibold text-[#0F172A] uppercase tracking-widest mb-5">Yasal</p>
              <ul className="flex flex-col gap-3">
                {legalLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-[#64748B] hover:text-[#059669] transition-colors cursor-pointer"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Divider + bottom bar */}
          <div className="border-t border-[#E2E8F0] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[#94A3B8]">
              © {year} İSGPanel. Tüm hakları saklıdır.
            </p>
            <p className="text-xs text-[#CBD5E1]">
              Türkiye
            </p>
          </div>

        </div>
      </footer>
    </>
  );
}
