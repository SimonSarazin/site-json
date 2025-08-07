import React from "react";
import { PreviewProps } from "@/modules/search/schema";
import PreviewDefault from "./preview/PreviewDefault";

/* -----------------------------------------------------------------------
 * Component
 * ---------------------------------------------------------------------*/
const Preview: React.FC<PreviewProps> = ({ item, preview = { type: "default" } }) => {
    switch (preview?.type) {
      case "default":
        return <PreviewDefault item={item} />;
      default:
        return <PreviewDefault item={item} />;
    }
};

export default Preview;
