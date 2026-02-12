import { useEffect } from "react";
import { Link } from "react-router";

export default function HeaderJuliePotVin({ header }: { header: any }
) {
    useEffect(() => {
        const body = document.body;
        body.classList.remove("opacity-0", "translate-y-10");
    }, []);

    return (
        <>
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-40 nav-sticky border-b border-gray-100">
                <div className="max-w-[1900px] mx-auto px-8 md:px-12 lg:px-16 py-5 flex justify-between items-center">

                    <div className="flex items-center gap-3">
                        <Link to="/" className="w-8 h-8 relative">
                            <img src="images/juliePotVin/monogramme.svg" alt="Monogramme" />

                            <div
                                id="portfolio-title"
                                className="absolute z-50 -mt-6 pb-16 px-8 md:px-12 lg:px-16 max-w-[1900px] mx-auto transition-all duration-300"
                            >
                                {/* <h1 className="text-[10px] -ml-5 md:text-xs uppercase tracking-[0.2em] text-gray-950 font-bold">
                                    PORTFOLIO DE JULIE POTVIN ––– DIRECTRICE ARTISTIQUE
                                </h1> */}
                            </div>
                        </Link>
                    </div>

                    <div className="flex gap-8 text-sm font-bold uppercase tracking-[0.15em]">
                        <Link to="/info" className="hover:text-teal-700 transition-colors">
                            Info
                        </Link>
                        <Link to="#" className="hover:text-teal-700 transition-colors">
                            Inspirations
                        </Link>
                    </div>

                </div>
            </nav>
        </>
    )
}
