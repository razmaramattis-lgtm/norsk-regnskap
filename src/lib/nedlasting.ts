/** Laster ned tekstinnhold som fil i nettleseren. */
export function lastNed(filnavn: string, innhold: string, mime = "application/xml;charset=utf-8") {
  const blob = new Blob([innhold], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filnavn;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Trygt filnavn: bokstaver, tall, punktum, bindestrek og understrek. */
export function filnavn(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}
