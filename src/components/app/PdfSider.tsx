import { useEffect, useRef, useState } from "react";

/** Tegner PDF-sider som bilder, slik at PDF vises også på mobil (der innebygd PDF ofte ikke virker). */
export function PdfSider({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [feil, setFeil] = useState(false);
  useEffect(() => {
    let avbrutt = false;
    const el = ref.current;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const doc = await pdfjs.getDocument({ url }).promise;
        if (!el || avbrutt) return;
        el.innerHTML = "";
        const bredde = el.clientWidth - 24 || 600;
        for (let n = 1; n <= Math.min(doc.numPages, 20); n++) {
          const side = await doc.getPage(n);
          if (avbrutt) return;
          const v0 = side.getViewport({ scale: 1 });
          const dpr = window.devicePixelRatio || 1;
          const vp = side.getViewport({ scale: (bredde / v0.width) * dpr });
          const c = document.createElement("canvas");
          c.width = vp.width;
          c.height = vp.height;
          c.style.width = `${bredde}px`;
          c.className = "mx-auto mb-3 rounded bg-white shadow-paper";
          el.appendChild(c);
          await side.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: vp }).promise;
        }
      } catch {
        if (!avbrutt) setFeil(true);
      }
    })();
    return () => { avbrutt = true; };
  }, [url]);
  if (feil) return <div className="p-6 text-sm text-destructive">Kunne ikke vise PDF-en. Bruk «Åpne».</div>;
  return <div ref={ref} className="absolute inset-0 overflow-auto p-3" />;
}
