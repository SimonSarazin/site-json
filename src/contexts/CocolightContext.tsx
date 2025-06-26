import { createContext, Dispatch, SetStateAction } from "react";

interface CocolightContextType {
  apiClient: any | null;
  userApi: any | null;
  loading: boolean;
  me: any;
  api: any | null;
  organization: any;
  helper: any;
  dataToProfile: any;
  setDataToProfile: Dispatch<SetStateAction<any>>;
}

export const CocolightContext = createContext<CocolightContextType | null>(null);
