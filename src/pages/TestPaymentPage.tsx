/**
 * Page de simulation de paiement HelloAsso en mode développement
 * Cette page simule l'interface HelloAsso pour tester le flux sans vraies credentials
 */

import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Loader2 } from "lucide-react";

export default function TestPaymentPage() {
  const { checkoutId } = useParams<{ checkoutId: string }>();
  const [status, setStatus] = useState<"pending" | "processing" | "success" | "error">("pending");

  useEffect(() => {
    // Simuler un délai de traitement
    if (status === "processing") {
      const timer = setTimeout(() => {
        setStatus("success");
        // Rediriger après succès
        setTimeout(() => {
          window.close();
        }, 2000);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleSuccess = () => {
    setStatus("processing");
  };

  const handleCancel = () => {
    setStatus("error");
    setTimeout(() => {
      window.close();
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧪 Simulation HelloAsso
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">TEST</span>
          </CardTitle>
          <CardDescription>
            Mode développement - Aucun paiement réel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm font-medium">Checkout ID:</p>
            <p className="text-xs text-muted-foreground font-mono break-all">{checkoutId}</p>
          </div>

          {status === "pending" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Cliquez sur "Simuler Succès" pour compléter le paiement test
              </p>
              <div className="flex gap-2">
                <Button onClick={handleSuccess} className="flex-1">
                  <Check className="w-4 h-4 mr-2" />
                  Simuler Succès
                </Button>
                <Button onClick={handleCancel} variant="destructive" className="flex-1">
                  <X className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {status === "processing" && (
            <div className="text-center py-6 space-y-3">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Traitement du paiement test...</p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-lg font-semibold text-green-600">Paiement simulé avec succès!</p>
              <p className="text-xs text-muted-foreground">Fermeture automatique...</p>
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-lg font-semibold text-red-600">Paiement annulé</p>
              <p className="text-xs text-muted-foreground">Fermeture automatique...</p>
            </div>
          )}

          <div className="text-xs text-muted-foreground text-center mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
            ⚠️ Ceci est une simulation. Pour utiliser le vrai HelloAsso, configurez
            <code className="mx-1 px-1 bg-yellow-100 rounded">HELLOASSO_CLIENT_SECRET</code>
            dans votre fichier .env
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



