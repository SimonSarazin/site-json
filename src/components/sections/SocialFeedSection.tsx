import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Linkedin, ExternalLink } from 'lucide-react';
import { SiX, SiInstagram, SiFacebook } from '@icons-pack/react-simple-icons';
import { cn } from '@/lib/utils';
import { SocialFeedSectionProps } from '@/types/site-schema';

export function SocialFeedSection({ id, props }: { id?: string; props: SocialFeedSectionProps }) {
  const { platform, limit = 6, layout = 'grid' } = props;

  const getPlatformIcon = () => {
    switch (platform) {
      case 'twitter':
        return <SiX className="w-5 h-5" />;
      case 'instagram':
        return <SiInstagram className="w-5 h-5" />;
      case 'linkedin':
        return <Linkedin className="w-5 h-5" />;
      case 'facebook':
        return <SiFacebook className="w-5 h-5" />;
      default:
        return <ExternalLink className="w-5 h-5" />;
    }
  };

  const getPlatformColor = () => {
    switch (platform) {
      case 'twitter':
        return 'text-info';
      case 'instagram':
        return 'text-chart-1';
      case 'linkedin':
        return 'text-chart-3';
      case 'facebook':
        return 'text-chart-2';
      default:
        return 'text-muted-foreground';
    }
  };

  // Mock data for demonstration
const referenceNow = new Date('2025-01-01T00:00:00Z').valueOf();

const mockPosts = Array.from({ length: limit }, (_, i) => {
  const seed = i + 1;                       // ← identifiant stable
  return {
    id: seed,
    content: `Contenu du post ${seed} depuis ${platform}. …`,
    author: `Utilisateur ${seed}`,
    avatar: `https://images.pexels.com/photos/${1_000_000 + seed}/pexels-photo-${1_000_000 + seed}.jpeg?…`,
    date  : new Date(referenceNow - seed * 864e5).toLocaleDateString(), // stable
    likes : (seed * 37) % 100,               // pseudo-aléatoire mais déterministe
    shares: (seed * 19) % 50,
  };
});

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className={cn("p-2 rounded-full bg-muted", getPlatformColor())}>
                {getPlatformIcon()}
              </div>
              <h2 className="text-3xl font-bold">
                Feed {platform.charAt(0).toUpperCase() + platform.slice(1)}
              </h2>
            </div>
            <p className="text-muted-foreground">
              Suivez nos dernières actualités sur {platform}
            </p>
          </div>

          {/* Posts Grid */}
          <div className={cn(
            "grid gap-6",
            layout === 'grid' && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
            layout === 'masonry' && "columns-1 md:columns-2 lg:columns-3",
            layout === 'carousel' && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 overflow-x-auto"
          )}>
            {mockPosts.map((post) => (
              <Card 
                key={post.id} 
                className={cn(
                  "transition-all duration-200 hover:shadow-lg",
                  layout === 'masonry' && "break-inside-avoid mb-6"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={post.avatar} alt={post.author} />
                      <AvatarFallback>{post.author[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{post.author}</div>
                      <div className="text-xs text-muted-foreground">{post.date}</div>
                    </div>
                    <div className={cn("p-1 rounded", getPlatformColor())}>
                      {getPlatformIcon()}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <p className="text-sm leading-relaxed mb-4">{post.content}</p>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{post.likes} likes</span>
                    <span>{post.shares} partages</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Call to Action */}
          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">
              Suivez-nous pour plus de contenu !
            </p>
            <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">
              <ExternalLink className="w-3 h-3 mr-2" />
              Voir sur {platform.charAt(0).toUpperCase() + platform.slice(1)}
            </Badge>
          </div>
        </div>
      </div>
    </section>
  );
}