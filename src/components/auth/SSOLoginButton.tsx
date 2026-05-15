import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSSOAuth } from "@/hooks/useSSOAuth";
import { getBaseUrl } from "@/lib/constant/common";

interface SSOLoginButtonProps {
  /** Identifiant du client OAuth (ex : "tierslieuxorg") — sert aussi à trouver l'image */
  provider: string;
  label?: string;
  onSuccess?: () => void;
  className?: string;
}

export default function SSOLoginButton({
  provider,
  label,
  onSuccess,
  className,
}: SSOLoginButtonProps): React.ReactNode {
  const [loading, setLoading]       = useState(false);
  const [imgError, setImgError]     = useState(false);
  const { openSSOPopup }            = useSSOAuth();

  const logoUrl = `${getBaseUrl()}/images/logoOauth/${provider}.jpg`;
  const resolvedLabel = label ?? provider;

  const handleClick = async () => {
    setLoading(true);
    try {
      const result = await openSSOPopup(provider);
      if (result.success) {
        onSuccess?.();
      } else if (result.error) {
        toast.error(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      disabled={loading}
      className={`w-full gap-2 ${className ?? ""}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      ) : !imgError ? (
        <img
          src={logoUrl}
          alt={resolvedLabel}
          className="h-4 w-4 object-contain shrink-0"
          onError={() => setImgError(true)}
        />
      ) : null}
      {resolvedLabel}
    </Button>
  );
}
