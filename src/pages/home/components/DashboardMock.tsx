export default function DashboardMock() {
  const stats = [
    { label: "Aktif Firma", value: "48", icon: "ri-building-2-line", color: "text-slate-700" },
    { label: "Toplam Personel", value: "1.240", icon: "ri-group-line", color: "text-slate-700" },
    { label: "Evrak", value: "3.891", icon: "ri-file-text-line", color: "text-slate-700" },
    { label: "Denetim", value: "127", icon: "ri-shield-check-line", color: "text-slate-700" },
  ];

  const rows = [
    { firma: "Arıkan Yapı A.Ş.", personel: 42, evrak: "Güncel", durum: "Aktif" },
    { firma: "Demirci Lojistik", personel: 18, evrak: "Eksik", durum: "Uyarı" },
    { firma: "Yıldız Enerji Ltd.", personel: 67, evrak: "Güncel", durum: "Aktif" },
    { firma: "Kaya İnşaat", personel: 31, evrak: "Güncel", durum: "Aktif" },
    { firma: "Özgür Tekstil", personel: 24, evrak: "Eksik", durum: "Uyarı" },
  ];

  return (
    <div className="w-full h-full bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-shield-check-line text-slate-700 text-sm"></i>
          </div>
          <span className="text-xs font-semibold text-slate-700 tracking-wide">İSGPanel</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-notification-3-line text-slate-400 text-sm"></i>
          </div>
          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
            <i className="ri-user-line text-slate-500 text-xs"></i>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-36 border-r border-gray-100 bg-slate-50 flex flex-col py-3 gap-1 px-2 shrink-0">
          {[
            { icon: "ri-dashboard-line", label: "Genel Bakış", active: true },
            { icon: "ri-building-2-line", label: "Firmalar", active: false },
            { icon: "ri-group-line", label: "Personeller", active: false },
            { icon: "ri-file-text-line", label: "Evraklar", active: false },
            { icon: "ri-shield-check-line", label: "Denetimler", active: false },
            { icon: "ri-tools-line", label: "Ekipmanlar", active: false },
          ].map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer ${
                item.active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                <i className={`${item.icon} text-xs`}></i>
              </div>
              <span className="text-xs font-medium whitespace-nowrap">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Main */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col gap-3">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="bg-slate-50 rounded-xl p-3 border border-gray-100">
                <div className="w-5 h-5 flex items-center justify-center mb-1">
                  <i className={`${s.icon} ${s.color} text-sm`}></i>
                </div>
                <div className="text-base font-bold text-slate-900">{s.value}</div>
                <div className="text-xs text-slate-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="flex-1 bg-slate-50 rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Firma Listesi</span>
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md px-2 py-1">
                <i className="ri-search-line text-slate-400 text-xs"></i>
                <span className="text-xs text-slate-300">Ara...</span>
              </div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2 text-slate-400 font-medium">Firma Adı</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium">Personel</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium">Evrak</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium">Durum</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.firma} className="border-b border-gray-50 hover:bg-white transition-colors">
                    <td className="px-4 py-2 text-slate-700 font-medium">{row.firma}</td>
                    <td className="px-4 py-2 text-slate-500">{row.personel}</td>
                    <td className="px-4 py-2 text-slate-500">{row.evrak}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.durum === "Aktif"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {row.durum}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
