import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Cookie, Settings, X } from 'lucide-react';
import { useLocalization } from '@/contexts/LocalizationContext';
import { cn } from '@/lib/utils';

interface CookieConsentSectionProps {
  id?: string;
  props: {
    message: Record<string, string>;
    acceptLabel: Record<string, string>;
    declineLabel?: Record<string, string>;
    settingsLabel?: Record<string, string>;
    policyUrl?: string;
    position?: 'bottom' | 'top' | 'bottom-left' | 'bottom-right';
    categories?: Array<{
      id: string;
      label: Record<string, string>;
      description: Record<string, string>;
      required?: boolean;
    }>;
  };
}

export function CookieConsentSection({ id, props }: CookieConsentSectionProps) {
  const { t } = useLocalization();
  const { 
    message, 
    acceptLabel, 
    declineLabel, 
    settingsLabel, 
    policyUrl, 
    position = 'bottom',
    categories = []
  } = props;
  
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check if user has already made a choice
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setIsVisible(true);
    }

    // Initialize preferences
    const initialPreferences: Record<string, boolean> = {};
    categories.forEach(category => {
      initialPreferences[category.id] = category.required || false;
    });
    setPreferences(initialPreferences);
  }, [categories]);

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'top-4 left-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4 max-w-md';
      case 'bottom-right':
        return 'bottom-4 right-4 max-w-md';
      default:
        return 'bottom-4 left-4 right-4';
    }
  };

  const handleAcceptAll = () => {
    const allAccepted: Record<string, boolean> = {};
    categories.forEach(category => {
      allAccepted[category.id] = true;
    });
    
    localStorage.setItem('cookie-consent', JSON.stringify({
      accepted: true,
      preferences: allAccepted,
      timestamp: new Date().toISOString()
    }));
    
    setIsVisible(false);
  };

  const handleDecline = () => {
    const requiredOnly: Record<string, boolean> = {};
    categories.forEach(category => {
      requiredOnly[category.id] = category.required || false;
    });
    
    localStorage.setItem('cookie-consent', JSON.stringify({
      accepted: false,
      preferences: requiredOnly,
      timestamp: new Date().toISOString()
    }));
    
    setIsVisible(false);
  };

  const handleSavePreferences = () => {
    localStorage.setItem('cookie-consent', JSON.stringify({
      accepted: true,
      preferences,
      timestamp: new Date().toISOString()
    }));
    
    setIsVisible(false);
    setShowSettings(false);
  };

  const handlePreferenceChange = (categoryId: string, checked: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [categoryId]: checked
    }));
  };

  if (!isVisible) return null;

  return (
    <div className={cn(
      "fixed z-50",
      getPositionClasses()
    )}>
      <Card className="shadow-lg border-2">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Cookie className="w-6 h-6 text-primary mt-1 shrink-0" />
            <div className="flex-1">
              <p className="text-sm leading-relaxed mb-4">
                {t(message)}
                {policyUrl && (
                  <>
                    {' '}
                    <a 
                      href={policyUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      En savoir plus
                    </a>
                  </>
                )}
              </p>
              
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleAcceptAll} size="sm">
                  {t(acceptLabel)}
                </Button>
                
                {declineLabel && (
                  <Button variant="outline" onClick={handleDecline} size="sm">
                    {t(declineLabel)}
                  </Button>
                )}
                
                {settingsLabel && categories.length > 0 && (
                  <Dialog open={showSettings} onOpenChange={setShowSettings}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Settings className="w-4 h-4 mr-2" />
                        {t(settingsLabel)}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Paramètres des cookies</DialogTitle>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        {categories.map((category) => (
                          <div key={category.id} className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={category.id}
                                checked={preferences[category.id]}
                                onCheckedChange={(checked) => 
                                  !category.required && handlePreferenceChange(category.id, Boolean(checked))
                                }
                                disabled={category.required}
                              />
                              <Label htmlFor={category.id} className="font-medium">
                                {t(category.label)}
                                {category.required && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    (Requis)
                                  </span>
                                )}
                              </Label>
                            </div>
                            <p className="text-xs text-muted-foreground ml-6">
                              {t(category.description)}
                            </p>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex gap-2 pt-4">
                        <Button onClick={handleSavePreferences} className="flex-1">
                          Sauvegarder
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setShowSettings(false)}
                        >
                          Annuler
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="shrink-0 p-1"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}