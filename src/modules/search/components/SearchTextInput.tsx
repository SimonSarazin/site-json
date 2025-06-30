import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";

interface SearchTextInputProps {
  placeholder?: string;
  value?: string;
  className?: string;
  onChange: (value: string) => void;
}

export default function SearchTextInput({ placeholder, value, className, onChange }: SearchTextInputProps) {
  return (
    <div className="relative">
      <Input
        className="peer ps-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type="search"
      />
      <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
        <SearchIcon size={16} />
      </div>

    </div>
  );
}
