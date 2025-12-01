import type { SearchEntity } from "@communecter/cocolight-api-client";
import { createContext } from 'react';
import { ProfileConfig } from '../schema';

interface ProfileEntityContextType {
  entity: SearchEntity;
  config: ProfileConfig;
  entityType: string;
}

export const ProfileEntityContext = createContext<ProfileEntityContextType | null>(null);


