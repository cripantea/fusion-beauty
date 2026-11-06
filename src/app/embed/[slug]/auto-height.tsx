"use client";

import { useEffect, useRef } from "react";

/**
 * Dentro l'iframe dello script embed comunica al sito ospite l'altezza del
 * contenuto, così l'agenda si allunga (e si accorcia) senza barre interne.
 * Si misura il contenitore e non il documento: il body è alto almeno quanto
 * l'iframe e l'altezza non scenderebbe mai.
 */
export function EmbedAutoHeight({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || window.parent === window) return;
    const post = () => window.parent.postMessage({ type: "fusion-beauty:height", height: node.offsetHeight }, "*");
    const observer = new ResizeObserver(post);
    observer.observe(node);
    post();
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
