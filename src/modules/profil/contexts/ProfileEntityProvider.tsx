import type { SearchEntity } from "@communecter/cocolight-api-client";
import { ProfileEntityContext } from "./ProfileEntityContext";
import { ProfileConfig } from "../schema";

interface ProfileEntityProviderProps {
  children: React.ReactNode;
  entity: SearchEntity;
  config: ProfileConfig;
  entityType: string;
}

export function ProfileEntityProvider({ children, entity, config, entityType }: ProfileEntityProviderProps) {
  return (
    <ProfileEntityContext.Provider value={{ entity, config, entityType }}>
      {children}
    </ProfileEntityContext.Provider>
  );
}
