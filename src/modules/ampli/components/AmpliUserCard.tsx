import { Image } from "@/components/layout/Image";
import { User } from "@communecter/cocolight-api-client";
import { MapPin } from "lucide-react";

interface AmpliUserProps {
    user: User | undefined;
    contributionCount?: number;
}

export default function AmpliUserCard({ user, contributionCount }: AmpliUserProps) {
    
    const addressString = user?.serverData.address
        ? [user?.serverData.address.streetAddress, user?.serverData.address.postalCode, user?.serverData.address.addressLocality]
            .filter(Boolean)
            .join(", ")
        : "Localisation non renseignée";
    return (
        <div className="ampli-user-card p-4 border border-foreground/15 shadow-foreground/10 shadow-[0_2px_8px] rounded-[12px] before:content-[''] before:duration-300 before:ease-in-out before:absolute before:top-0 before:left-0 before:w-full before:h-1 before:bg-linear-to-r before:from-primary before:to-secondary before:scale-x-0 hover:before:scale-x-[1] transition-all relative overflow-hidden bg-background/70">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-primary">
                    {user?.serverData.profilMediumImageUrl ?
                        (
                            <Image src={user?.serverData.profilMediumImageUrl} alt={user?.serverData.name ?? ""} className="w-full h-full object-cover"/>
                        ) :
                        (<div className="text-white flex items-center justify-center w-full h-full text-3xl font-bold">
                            {user?.serverData.name ? user.serverData.name.charAt(0).toUpperCase() : "?"}
                        </div>)
                    }
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-semibold whitespace-nowrap text-ellipsis overflow-hidden mb-1">{user?.serverData.name ?? ""}</h3>
                    {
                        addressString && (
                            <p className="flex gap-1 items-center">
                                <MapPin className="w-4 h-4 text-foreground/75" />
                                <span className="flex-1 text-[14px] text-foreground/75">{addressString}</span>
                            </p>
                        )
                    }
                    <div className="mt-2 flex items-center flex-wrap gap-2.5">

                    </div>
                </div>
            </div>
        </div>
    );
}