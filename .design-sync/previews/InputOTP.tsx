import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  Label,
} from "site-forge";

// Code à usage unique — validation d'inscription par SMS.
// Valeurs contrôlées (onChange no-op) pour des captures déterministes.

export const SaisieEnCours = () => (
  <div className="space-y-2">
    <Label htmlFor="otp-1">Code reçu par SMS</Label>
    <InputOTP id="otp-1" maxLength={6} value="49" onChange={() => {}}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
    <p className="text-muted-foreground text-sm">Saisissez les 6 chiffres envoyés au 06 •• •• 34 81.</p>
  </div>
);

export const CodeComplet = () => (
  <div className="space-y-2">
    <Label htmlFor="otp-2">Code de confirmation</Label>
    <InputOTP id="otp-2" maxLength={6} value="491203" onChange={() => {}}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  </div>
);

export const Erreur = () => (
  <div className="space-y-2">
    <Label htmlFor="otp-3">Code de confirmation</Label>
    <InputOTP id="otp-3" maxLength={4} value="7302" onChange={() => {}}>
      <InputOTPGroup>
        <InputOTPSlot index={0} aria-invalid />
        <InputOTPSlot index={1} aria-invalid />
        <InputOTPSlot index={2} aria-invalid />
        <InputOTPSlot index={3} aria-invalid />
      </InputOTPGroup>
    </InputOTP>
    <p className="text-destructive text-sm">Code expiré — demandez un nouvel envoi.</p>
  </div>
);

export const Desactive = () => (
  <div className="space-y-2">
    <Label htmlFor="otp-4">Code reçu par SMS</Label>
    <InputOTP id="otp-4" maxLength={6} value="" onChange={() => {}} disabled>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
    <p className="text-muted-foreground text-sm">Renseignez d'abord votre numéro de téléphone.</p>
  </div>
);
