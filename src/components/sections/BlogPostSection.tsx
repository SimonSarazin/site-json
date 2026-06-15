import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, User } from 'lucide-react';
import { useLocalization } from "@/hooks/useLocalization";
import { BlogPostSectionProps } from '@/types/site-schema';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { formatDateLong } from '@/helpers/formatDate';

export function BlogPostSection({ id, props }: { id?: string; props: BlogPostSectionProps }) {
  const { t } = useLocalization();
  const { title, excerpt, content, author, publishedAt, tags, featuredImage, readTime } = props;

  return (
    <article id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Featured Image */}
          {featuredImage && (
            <div className="mb-8 rounded-lg overflow-hidden">
              <OptimizedImage
                src={featuredImage}
                alt={t(title)}
                width={800}
                priority
                className="w-full h-64 md:h-96 object-cover"
              />
            </div>
          )}

          {/* Header */}
          <header className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              {t(title)}
            </h1>
            
            {excerpt && (
              <p className="text-xl text-muted-foreground mb-6 leading-relaxed">
                {t(excerpt)}
              </p>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
              {publishedAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDateLong(publishedAt)}</span>
                </div>
              )}
              
              {readTime && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{readTime} min de lecture</span>
                </div>
              )}
            </div>

            {/* Author */}
            {author && (
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg mb-6">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={author.avatar} alt={t(author.name)} />
                  <AvatarFallback>
                    <User className="w-6 h-6" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-foreground">{t(author.name)}</div>
                  {author.bio && (
                    <div className="text-sm text-muted-foreground">{t(author.bio)}</div>
                  )}
                </div>
              </div>
            )}

            {/* Tags */}
            {tags && tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <Badge key={index} variant="secondary">
                    {t(tag)}
                  </Badge>
                ))}
              </div>
            )}
          </header>

          {/* Content */}
          <div className="prose prose-lg max-w-none dark:prose-invert">
            <div dangerouslySetInnerHTML={{ __html: t(content) }} suppressHydrationWarning />
          </div>
        </div>
      </div>
    </article>
  );
}
export default BlogPostSection;
