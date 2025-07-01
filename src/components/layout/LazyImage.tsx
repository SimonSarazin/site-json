import { useEffect, useRef, useState } from "react";

interface LazyImageProps {
  src?: string;
  alt: string;
  className?: string;
  placeholder?: React.ReactNode;
  [key: string]: any; // Pour les autres props d'image
}

/**
 * Composant d'image chargé uniquement lorsqu'elle est visible dans le viewport.
 *
 * @param {string} src - L'URL de l'image
 * @param {string} alt - Texte alternatif pour l'image
 * @param {string} className - Classes CSS personnalisées
 * @param {React.ReactNode} placeholder - Élément affiché en attendant (facultatif)
 * @param {object} imgProps - Autres props à passer à la balise <img>
 */
export default function LazyImage({
  src,
  alt, 
  className = "", 
  placeholder = null, 
  ...imgProps 
}: LazyImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1 }
    );

    const current = containerRef.current;
    if (current) observer.observe(current);

    return () => {
      if (current) observer.unobserve(current);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
      {visible ? (
        <img src={src || undefined} alt={alt} className={className} {...imgProps} />
      ) : (
        placeholder || <div className={`w-full h-full bg-gray-100 animate-pulse ${className}`} />
      )}
    </div>
  );
}
