import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import * as Icons from 'lucide-react';
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from '@/lib/utils';

interface TeamSectionProps {
  id?: string;
  props: {
    members: Array<{
      name: Record<string, string>;
      role: Record<string, string>;
      bio?: Record<string, string>;
      avatar: string;
      socials?: Array<{
        platform: string;
        url: string;
      }>;
    }>;
    layout?: 'grid' | 'carousel';
    columns?: 1 | 2 | 3 | 4 | 5 | 6;
  };
}

export function TeamSection({ id, props }: TeamSectionProps) {
  const { t } = useLocalization();
  const { members, layout = 'grid', columns = 3 } = props;

  const getGridCols = (cols: number) => {
    const colsMap = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 md:grid-cols-2',
      3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
      5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
      6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
    } as const;
    return colsMap[cols as keyof typeof colsMap];
  };

  const getSocialIcon = (platform: string) => {
    const iconMap: Record<string, any> = {
      twitter: Icons.Twitter,
      linkedin: Icons.Linkedin,
      github: Icons.Github,
      facebook: Icons.Facebook,
      instagram: Icons.Instagram,
      youtube: Icons.Youtube,
      globe: Icons.Globe,
      mail: Icons.Mail,
    };
    
    const IconComponent = iconMap[platform.toLowerCase()] || Icons.Globe;
    return <IconComponent className="w-4 h-4" />;
  };

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={cn(
          layout === 'grid' && `grid gap-8 ${getGridCols(columns)}`,
          layout === 'carousel' && "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        )}>
          {members.map((member, index) => (
            <Card key={index} className="text-center group hover:shadow-lg transition-all duration-200">
              <CardHeader className="pb-4">
                <div className="relative mx-auto mb-4">
                  <Avatar className="w-24 h-24 mx-auto ring-4 ring-background group-hover:ring-primary/20 transition-all duration-200">
                    <AvatarImage src={member.avatar} alt={t(member.name)} />
                    <AvatarFallback className="text-lg">
                      {t(member.name).split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                </div>
                
                <h3 className="text-xl font-bold text-foreground mb-1">
                  {t(member.name)}
                </h3>
                
                <p className="text-primary font-medium">
                  {t(member.role)}
                </p>
              </CardHeader>
              
              <CardContent>
                {member.bio && (
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                    {t(member.bio)}
                  </p>
                )}
                
                {member.socials && member.socials.length > 0 && (
                  <div className="flex justify-center gap-2">
                    {member.socials.map((social, socialIndex) => (
                      <Button
                        key={socialIndex}
                        variant="ghost"
                        size="sm"
                        className="w-9 h-9 p-0 hover:bg-primary/10 hover:text-primary"
                        asChild
                      >
                        <a
                          href={social.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${t(member.name)} sur ${social.platform}`}
                        >
                          {getSocialIcon(social.platform)}
                        </a>
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}