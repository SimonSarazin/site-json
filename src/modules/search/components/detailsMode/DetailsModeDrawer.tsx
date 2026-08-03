import CustomDrawer from "@/components/layout/CustomDrawer";
import { useT } from "@/hooks/useT";
import Preview from "../Preview";
import { DetailsModeProps } from "../../schema";

export default function DetailsModeDrawer({ openDetails, setOpenDetails, item, preview, list }: DetailsModeProps) {
    const t = useT("modules/search");

    return (
        <CustomDrawer
          isOpenDrawer={openDetails}
          openAndCloseDrawer={() => setOpenDetails(false)}
          direction="right"
          openPageTitle={t("Aller sur la page")}
          overflowType="overflow-hidden"
          link={item?.slug ? `/profil/${item.slug}` : undefined}
        >
          {item && (
            <Preview item={item} preview={preview} list={list} onClose={() => setOpenDetails(false)} />
          )}
        </CustomDrawer>
    );
}