import React, {
  useState,
  type ChangeEventHandler,
  type InputHTMLAttributes,
} from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/** Props acceptées par PasswordToggleTextInput */
export interface PasswordToggleTextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /** Valeur contrôlée du champ */
  value: string;
  /** Callback onChange (hérite de la signature standard) */
  onChange: ChangeEventHandler<HTMLInputElement>;
  /** Placeholder custom (défaut : « Mot de passe ») */
  placeholder?: string;
  /** Classe(s) CSS additionnelle(s) */
  className?: string;
}

/* ------------------------------------------------------------------ */
export default function PasswordToggleTextInput({
  value,
  onChange,
  placeholder = "Mot de passe",
  className,
  ...props
}: PasswordToggleTextInputProps): React.ReactNode {
  const [showPassword, setShowPassword] = useState<boolean>(false);

  return (
    <div className="relative">
      <Input
        type={showPassword ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`pr-10 ${className ?? ""}`}
        {...props}
      />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
        onClick={() => setShowPassword((prev) => !prev)}
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Eye className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="sr-only">
          {showPassword
            ? "Masquer le mot de passe"
            : "Afficher le mot de passe"}
        </span>
      </Button>
    </div>
  );
}
