import { cn } from '@/lib/utils';

interface VideoSectionProps {
  id?: string;
  props: {
    src: string;
    provider?: 'youtube' | 'vimeo' | 'local' | 'loom';
    ratio?: '16/9' | '4/3' | '1/1' | '9/16';
    autoplay?: boolean;
    controls?: boolean;
    loop?: boolean;
  };
}

export function VideoSection({ id, props }: VideoSectionProps) {
  const { provider = 'youtube', ratio = '16/9', autoplay, controls = true, loop = false, src } = props;

  const getAspectRatio = (ratio: string) => {
    switch (ratio) {
      case '4/3':
        return 'aspect-[4/3]';
      case '1/1':
        return 'aspect-square';
      case '9/16':
        return 'aspect-[9/16]';
      default:
        return 'aspect-video';
    }
  };

  const getEmbedUrl = (provider: string, src: string) => {
    switch (provider) {
      case 'youtube':
        { const youtubeParams = new URLSearchParams();
        if (autoplay) youtubeParams.set('autoplay', '1');
        if (!controls) youtubeParams.set('controls', '0');
        if (loop) youtubeParams.set('loop', '1');
        return `https://www.youtube.com/embed/${src}?${youtubeParams.toString()}`; }
      
      case 'vimeo':
        { const vimeoParams = new URLSearchParams();
        if (autoplay) vimeoParams.set('autoplay', '1');
        if (loop) vimeoParams.set('loop', '1');
        return `https://player.vimeo.com/video/${src}?${vimeoParams.toString()}`; }
      
      case 'loom':
        return `https://www.loom.com/embed/${src}`;
      
      default:
        return src;
    }
  };

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className={cn("rounded-lg overflow-hidden", getAspectRatio(ratio))}>
            {provider === 'local' ? (
              <video
                src={src}
                controls={controls}
                autoPlay={autoplay}
                loop={loop}
                className="w-full h-full object-cover"
                playsInline
              />
            ) : (
              <iframe
                src={getEmbedUrl(provider, src)}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}