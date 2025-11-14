import CustomDrawer from "@/components/layout/CustomDrawer";
import { useT } from "@/hooks/useT";
import Preview from "../Preview";
import { DetailsModeProps } from "../../schema";

export default function DetailsModeDrawer({ openDetails, setOpenDetails, item, preview }: DetailsModeProps) {
    const t = useT("modules/search");

    return (
        <CustomDrawer
          isOpenDrawer={openDetails}
          openAndCloseDrawer={() => setOpenDetails(false)}
          direction="right"
          openPageTitle={t("Aller sur la page")}
          overflowType="overflow-hidden"
          link={`/profil/${item?.slug}`}
        >
          {item && <Preview item={item} preview={preview} />}
        </CustomDrawer>
    );
}   