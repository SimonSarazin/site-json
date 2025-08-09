import { usePage } from "@/hooks/usePage";


const useInSections = (id: string): boolean => {
  const { page } = usePage();
  const section = page.sections.find((s) => s.id === id);
  return !!section;
};


export default useInSections;