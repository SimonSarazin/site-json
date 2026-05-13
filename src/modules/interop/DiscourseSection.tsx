import { lazy } from "react";
import { useInteropUserLinks } from "./hooks/useUserInteropLinks";

const DiscoursePod = lazy(() => import("./components/DiscoursePod"));
const DiscourseLink = lazy(() => import("./components/DiscourseLink"));

const DiscourseSection = () => {
    const { isDiscourseLinked, isOwnProfile } = useInteropUserLinks();

    if (!isDiscourseLinked && !isOwnProfile) return null;

    return (
        <>
            {isDiscourseLinked ? <DiscoursePod /> : <DiscourseLink />}
        </>
    );
}

export default DiscourseSection;