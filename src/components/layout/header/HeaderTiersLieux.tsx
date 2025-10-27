import { ChevronDown } from "lucide-react";
import { Link } from "react-router";

interface HeaderTiersLieuxProps {
    header: any;
    locale?: "fr" | "en";
}

export default function HeaderTiersLieux({ header, locale = "fr" }: HeaderTiersLieuxProps) {

    return (
        <header className={`${header.transparent ? "bg-transparent" : "bg-white"} border-b ${header.sticky ? "sticky top-0 z-30" : ""}`}>
            <nav className="container mx-auto py-4">
                <div className="flex items-center justify-between">
                    <Link to={header.path} className="flex items-center space-x-2">
                        {header.logo && (
                            <img
                                src={`/${header.logo}`}
                                alt={header.logoAlt?.[locale] || "Tiers Lieux"}
                            />
                        )}
                    </Link>

                    {/* Menu desktop */}
                    <div className="hidden md:flex items-center space-x-8 text-sm font-medium">
                        {header.nav.map((item, idx) => {
                            const hasChildren = !!item.children?.length;

                            return (
                                <div key={idx} className="relative group">
                                    <Link to="#" className="hover:text-teal-500 text-gray-800 transition flex items-center gap-1">
                                        {item.label?.[locale]}
                                        {hasChildren && <ChevronDown className="w-3 h-3" />}
                                    </Link>

                                    {hasChildren && (
                                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-screen max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 p-8 z-50">
                                            {item.label?.[locale] === "Les lieux" ? (
                                                <div className="grid grid-cols-3 gap-8">
                                                    <div className="flex flex-col items-center justify-center border-r border-gray-200 pr-6">
                                                        <div className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center mb-4">
                                                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                            </svg>
                                                        </div>
                                                        <h3 className="font-bold text-gray-900 text-center mb-2">
                                                            {item.children[0].label?.[locale]}
                                                        </h3>
                                                        <Link to="/lieux" className="text-teal-500 font-semibold flex items-center gap-2">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                            </svg>
                                                        </Link>
                                                    </div>

                                                    <div className="col-span-2 grid grid-cols-2 gap-6">
                                                        {item.children.slice(1).map((sub, i) => (
                                                            <div key={i}>
                                                                <h4 className="font-bold text-gray-900 mb-2">{sub.label?.[locale]}</h4>
                                                                <p className="text-gray-600 text-xs leading-relaxed">
                                                                    {sub.description?.[locale] || ""}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : item.children.length > 2 ? (
                                                <div className="grid grid-cols-2 gap-6">
                                                    {item.children.map((sub, i) => (
                                                        <div key={i}>
                                                            <h4 className="font-bold text-gray-900 mb-2">{sub.label?.[locale]}</h4>
                                                            <p className="text-gray-600 text-xs leading-relaxed">
                                                                {sub.description?.[locale] || ""}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {item.children.map((sub, i) => (
                                                        <div key={i}>
                                                            <h4 className="font-bold text-gray-900 mb-2">{sub.label?.[locale]}</h4>
                                                            <p className="text-gray-600 text-xs leading-relaxed">
                                                                {sub.description?.[locale] || ""}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {header.utilities?.auth && (
                        <div className="hidden md:flex items-center space-x-4 text-sm">
                            <div className="bg-gray-100 rounded-full px-4 py-1.5 flex items-center gap-2">
                                <button className="font-medium rounded-full px-1 bg-white py-1 text-gray-700">CN</button>
                                <span className="text-gray-300">|</span>
                                <button className="font-medium text-gray-700">Nom Prénom</button>
                            </div>
                            <button className="text-gray-700 hover:text-teal-500 transition">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>
                            <button className="text-gray-700 hover:text-teal-500 transition">
                                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M21 15H22C22 14.4477 21.5523 14 21 14V15ZM21 21V22C21.5523 22 22 21.5523 22 21H21ZM1 21H0C0 21.5523 0.447715 22 1 22L1 21ZM1 15V14C0.447715 14 0 14.4477 0 15H1ZM6 8C5.44772 8 5 8.44772 5 9C5 9.55229 5.44772 10 6 10V9V8ZM11 10C11.5523 10 12 9.55229 12 9C12 8.44772 11.5523 8 11 8V9V10ZM13.24 7.05C13.599 7.4697 14.2302 7.51892 14.6499 7.15993C15.0696 6.80095 15.1189 6.1697 14.7599 5.75L13.9999 6.4L13.24 7.05ZM14.7599 12.25C15.1189 11.8303 15.0696 11.1991 14.6499 10.8401C14.2302 10.4811 13.599 10.5303 13.24 10.95L13.9999 11.6L14.7599 12.25ZM21 15H20V21H21H22V15H21ZM21 21V20H1V21V22H21V21ZM1 21H2V15H1H0V21H1ZM16.5556 15V16H21V15V14H16.5556V15ZM1 15V16H5.44444V15V14H1V15ZM19 9H18C18 12.866 14.866 16 11 16V17V18C15.9706 18 20 13.9706 20 9H19ZM11 17V16C7.13401 16 4 12.866 4 9H3H2C2 13.9706 6.02944 18 11 18V17ZM3 9H4C4 5.13401 7.13401 2 11 2V1V0C6.02944 0 2 4.02944 2 9H3ZM11 1V2C14.866 2 18 5.13401 18 9H19H20C20 4.02944 15.9706 0 11 0V1ZM6 9V10H11V9V8H6V9ZM13.9999 6.4L14.7599 5.75C14.0955 4.9733 13.2091 4.41884 12.22 4.16132L11.9681 5.12905L11.7161 6.09679C12.3096 6.25131 12.8414 6.58398 13.24 7.05L13.9999 6.4ZM11.9681 5.12905L12.22 4.16132C11.2309 3.90379 10.1867 3.95557 9.22792 4.30967L9.57437 5.24774L9.92083 6.1858C10.4961 5.97334 11.1226 5.94228 11.7161 6.09679L11.9681 5.12905ZM9.57437 5.24774L9.22792 4.30967C8.26915 4.66378 7.44193 5.30319 6.85768 6.14181L7.67818 6.71344L8.49869 7.28508C8.84924 6.78192 9.34557 6.39827 9.92083 6.1858L9.57437 5.24774ZM7.67818 6.71344L6.85768 6.14181C6.27343 6.98042 5.96021 7.97793 5.96021 9H6.96021H7.96021C7.96021 8.38676 8.14814 7.78825 8.49869 7.28508L7.67818 6.71344ZM6.96021 9H5.96021C5.96021 10.0221 6.27343 11.0196 6.85768 11.8582L7.67818 11.2866L8.49869 10.7149C8.14814 10.2118 7.96021 9.61324 7.96021 9H6.96021ZM7.67818 11.2866L6.85768 11.8582C7.44193 12.6968 8.26915 13.3362 9.22792 13.6903L9.57437 12.7523L9.92083 11.8142C9.34557 11.6017 8.84924 11.2181 8.49869 10.7149L7.67818 11.2866ZM9.57437 12.7523L9.22792 13.6903C10.1867 14.0444 11.2309 14.0962 12.22 13.8387L11.9681 12.8709L11.7161 11.9032C11.1226 12.0577 10.4961 12.0267 9.92083 11.8142L9.57437 12.7523ZM11.9681 12.8709L12.22 13.8387C13.2091 13.5812 14.0955 13.0267 14.7599 12.25L13.9999 11.6L13.24 10.95C12.8414 11.416 12.3096 11.7487 11.7161 11.9032L11.9681 12.8709Z" fill="currentColor"></path>
                                </svg>
                            </button>
                        </div>
                    )}

                    {/* Bouton menu hamburger (mobile) */}
                    <button className="md:hidden text-gray-700 hover:text-teal-500 transition relative z-50">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </div>
            </nav>
        </header>
    );
}