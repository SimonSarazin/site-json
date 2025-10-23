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
  const [selectedCategory, setSelectedCategory] = useState("all");

  const isFullStyle = props.ctaButtons && props.ctaButtons.length > 0 && props.subhead;

  if (!isFullStyle) {
    return (
      <section className="relative min-h-[450px] flex flex-col -mt-10">
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <div 
                className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-white/20"
                style={{
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)'
                }}
              >
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">
                  {t(props.headline)}
                </h1>

                <div className="flex gap-0 shadow-xl rounded-full overflow-hidden">
                  <div className="relative">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="h-full pl-6 pr-10 bg-white text-gray-700 font-medium focus:outline-none appearance-none cursor-pointer border-r border-gray-200"
                      style={{ minWidth: '150px' }}
                    >
                      <option value="all">Tous les lieux</option>
                      <option value="coworking">Coworking</option>
                      <option value="fablab">Fablab</option>
                      <option value="meeting">Se réunir</option>
                      <option value="food">Manger</option>
                      <option value="learn">S'instruire</option>
                      <option value="stay">Séjourner</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={props.placeholder ? t(props.placeholder) : "Nom, ville, département, code postal ..."}
                    className="flex-1 px-6 py-4 bg-white text-gray-700 focus:outline-none"
                  />

                  <button className="px-8 py-4 bg-teal-500 text-white font-semibold hover:bg-teal-600 transition flex items-center gap-2">
                    {props.searchButtonText ? t(props.searchButtonText) : "Rechercher"}
                    <svg 
                      className="w-4 h-4" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {props.backgroundImage && (
          <div className="absolute bottom-0 left-0 right-0 h-64 overflow-hidden">
            <img
              src={props.backgroundImage}
              className="w-full h-full object-cover object-top"
              alt=""
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="bg-white relative">
      <div className="container mx-auto px-6">
        <h1 className="text-5xl font-extrabold pt-6 text-center text-gray-900 mb-4">
          {t(props.headline)}
        </h1>

        {props.subhead && (
          <p className="text-center text-teal-500 font-light text-xl italic mb-5">
            {t(props.subhead)}
          </p>
        )}

        <div className="flex justify-center space-x-1 mb-8 text-sm flex-wrap">
          {props.ctaButtons?.map((btn, idx) => (
            <button
              key={idx}
              className={`px-6 py-3 font-semibold ${
                idx === 0
                  ? "border-b-4 border-teal-500 text-teal-500 bg-gray-50"
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
            <button className="px-10 py-4 bg-teal-500 text-white font-semibold hover:bg-blue-900 transition flex items-center gap-2">
              {props.searchButtonText ? t(props.searchButtonText) : "Rechercher"}
              <span className="text-lg">
                <svg 
                  className="w-5 h-5" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                  />
                </svg>
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