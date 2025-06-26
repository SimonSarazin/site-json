import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocalization } from "@/hooks/useLocalization";
import { useNavigate } from "react-router";
import { cn } from '@/lib/utils';

interface BlogListSectionProps {
  id?: string;
  props: {
    posts: Array<{
      id: string;
      title: Record<string, string>;
      excerpt: Record<string, string>;
      slug: string;
      publishedAt: string;
      author?: {
        name: Record<string, string>;
        avatar?: string;
      };
      featuredImage?: string;
      tags?: Array<Record<string, string>>;
      readTime?: number;
    }>;
    layout?: 'grid' | 'list' | 'masonry';
    columns?: 1 | 2 | 3 | 4 | 5 | 6;
    pagination?: boolean;
    postsPerPage?: number;
  };
}

export function BlogListSection({ id, props }: BlogListSectionProps) {
  const { t } = useLocalization();
const navigate = useNavigate();
  const { posts, layout = 'grid', columns = 3, pagination = true, postsPerPage = 9 } = props;
  
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.ceil(posts.length / postsPerPage);
  const startIndex = (currentPage - 1) * postsPerPage;
  const endIndex = startIndex + postsPerPage;
  const currentPosts = pagination ? posts.slice(startIndex, endIndex) : posts;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getGridCols = (cols: number) => {
    const colsMap = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 md:grid-cols-2',
      3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
      5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
      6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
    };
    return colsMap[cols];
  };

  const PostCard = ({ post }: { post: any }) => (
    <Card 
      className={cn(
        "h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-1 cursor-pointer",
        layout === 'masonry' && "break-inside-avoid mb-6"
      )}
      onClick={() => navigate(`/blog/${post.slug}`)}
    >
      {post.featuredImage && (
        <div className="w-full h-48 overflow-hidden rounded-t-lg">
          <img 
            src={post.featuredImage} 
            alt={t(post.title)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      
      <CardHeader>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Calendar className="w-4 h-4" />
          <span>{formatDate(post.publishedAt)}</span>
          {post.readTime && (
            <>
              <Clock className="w-4 h-4 ml-2" />
              <span>{post.readTime} min</span>
            </>
          )}
        </div>
        
        <CardTitle className="text-xl mb-2 text-foreground line-clamp-2">
          {t(post.title)}
        </CardTitle>
        
        <CardDescription className="text-base leading-relaxed line-clamp-3">
          {t(post.excerpt)}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {/* Author */}
        {post.author && (
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="w-8 h-8">
              <AvatarImage src={post.author.avatar} alt={t(post.author.name)} />
              <AvatarFallback>
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">{t(post.author.name)}</span>
          </div>
        )}
        
        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {t(tag)}
              </Badge>
            ))}
            {post.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{post.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Posts Grid */}
        <div className={cn(
          layout === 'grid' && `grid gap-6 ${getGridCols(columns)}`,
          layout === 'list' && "space-y-6",
          layout === 'masonry' && `columns-1 md:columns-${Math.min(columns, 2)} lg:columns-${columns} gap-6`
        )}>
          {currentPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>

        {/* Pagination */}
        {pagination && totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-12">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Précédent
            </Button>
            
            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className="w-10 h-10 p-0"
                >
                  {page}
                </Button>
              ))}
            </div>
            
            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Suivant
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}