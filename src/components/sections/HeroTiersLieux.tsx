import { useLocalization } from "@/hooks/useLocalization";
import { useState } from "react";

interface HeroTiersLieuxProps {
  props: {
    headline: { fr: string; en: string };
    subhead?: { fr: string; en: string };
    ctaButtons?: { label: { fr: string; en: string }; variant?: "default" | "secondary" }[];
    placeholder?: { fr: string; en: string };
    backgroundImage?: string;
    searchButtonText?: { fr: string; en: string };
    searchIcon?: React.ReactNode;
  };
}

export function HeroTiersLieux({ props }: HeroTiersLieuxProps) {
  const { t } = useLocalization();
  const [search, setSearch] = useState("");

  return (
    <section className="bg-white relative">
      <div className="container mx-auto px-6">
        <h1 className="text-5xl font-extrabold pt-6 text-center text-gray-900 mb-4">
          {t(props.headline)}
        </h1>

        {props.subhead && (
          <p className="text-center text-cyan-500 font-light text-xl italic mb-5">
            {t(props.subhead)}
          </p>
        )}

          <div className="flex justify-center space-x-1 mb-8 text-sm flex-wrap">
            {props.ctaButtons?.map((btn, idx) => (
              <button
                key={idx}
                className={`px-6 py-3 font-semibold ${
                  idx === 0
                    ? "border-b-4 border-cyan-500 text-cyan-500 bg-gray-50"
                    : "hover:bg-gray-50 transition"
                }`}
              >
                {t(btn.label)}
              </button>
            ))}
          </div>

          <div className="relative z-10 max-w-4xl mx-auto -mb-8">
            <div className="flex gap-0 shadow-xl rounded-full overflow-hidden">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={props.placeholder ? t(props.placeholder) : "Ville, département, code postal ..."}
                className="flex-1 bg-white px-6 py-4 border-0 focus:outline-none text-gray-700"
              />
              <button className="px-10 py-4 bg-cyan-500 text-white font-semibold hover:bg-blue-900 transition flex items-center gap-2">
                {props.searchButtonText ? t(props.searchButtonText) : "Rechercher"}
                <span className="text-lg">
                  {props.searchIcon || <i className="fa-solid fa-magnifying-glass"></i>}
                </span>
              </button>
            </div>
          </div>

        {props.backgroundImage && (
          <div className="relative w-full h-48 -mx-6 lg:-mx-12 overflow-hidden">
            <img
              src={props.backgroundImage}
              className="absolute inset-0 w-full h-full object-cover object-center opacity-90"
              alt={t(props.headline)}
            />
          </div>
        )}
      </div>
    </section>
  );
}