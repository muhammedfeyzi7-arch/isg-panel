/** Metni dosya olarak indirir (yalnızca istemci). CSV için Excel uyumu adına UTF-8 BOM eklenir. */
export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const bom = mime.startsWith("text/csv") ? "﻿" : "";
  const blob = new Blob([bom + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
