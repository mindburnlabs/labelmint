import React, { useState, useRef, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  priority = false,
  className = '',
  onLoad,
  onError,
  placeholder = 'blur',
  blurDataURL
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer for lazy loading
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
    rootMargin: '50px'
  });

  // Generate responsive image sources
  const generateSrcSet = (baseSrc: string): string => {
    const widths = [320, 640, 768, 1024, 1280, 1536];
    return widths
      .map(w => `${baseSrc}?w=${w}&q=80&format=webp ${w}w`)
      .join(', ');
  };

  // Preload critical images
  useEffect(() => {
    if (priority && src) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      document.head.appendChild(link);

      return () => {
        document.head.removeChild(link);
      };
    }
  }, [priority, src]);

  // Load image when in view (or if priority)
  useEffect(() => {
    if ((inView || priority) && src && currentSrc !== src) {
      setCurrentSrc(src);
    }
  }, [inView, priority, src, currentSrc]);

  // Handle image load
  const handleLoad = (): void => {
    setIsLoaded(true);
    onLoad?.();
  };

  // Handle image error
  const handleError = (): void => {
    setHasError(true);
    onError?.();
  };

  // Combine refs
  const combinedRef = (node: HTMLImageElement) => {
    imgRef.current = node;
    ref(node);
  };

  // Generate placeholder style
  const getPlaceholderStyle = (): React.CSSProperties => {
    if (placeholder === 'blur' && blurDataURL) {
      return {
        backgroundImage: `url(${blurDataURL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(8px)',
        transform: 'scale(1.1)'
      };
    }
    return {
      backgroundColor: '#f3f4f6'
    };
  };

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-200 text-gray-500 ${className}`}
        style={{ width, height }}
      >
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      {/* Placeholder */}
      {!isLoaded && placeholder !== 'empty' && (
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={getPlaceholderStyle()}
        />
      )}

      {/* Main image */}
      {currentSrc ? (
        <picture>
          <source
            srcSet={generateSrcSet(currentSrc)}
            type="image/webp"
          />
          <img
            ref={combinedRef}
            src={currentSrc}
            alt={alt}
            width={width}
            height={height}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
            className={`
              w-full h-full object-cover
              transition-opacity duration-300
              ${isLoaded ? 'opacity-100' : 'opacity-0'}
            `}
            style={{
              contentVisibility: 'auto',
              containIntrinsicSize: width && height ? `${width}px ${height}px` : '400px 300px'
            }}
          />
        </picture>
      ) : (
        // Placeholder div when not loaded yet
        <div
          ref={combinedRef}
          className="w-full h-full"
          style={getPlaceholderStyle()}
        />
      )}

      {/* Loading indicator */}
      {!isLoaded && currentSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}
    </div>
  );
};

// Hook for preloading images
export const useImagePreloader = (): ((src: string) => void) => {
  const preloadedImages = useRef(new Set<string>());

  return (src: string): void => {
    if (preloadedImages.current.has(src)) return;

    const img = new Image();
    img.onload = () => {
      preloadedImages.current.add(src);
    };
    img.src = src;
  };
};

// Component for preloading critical images
export const ImagePreloader: React.FC<{ images: string[] }> = ({ images }) => {
  const preloadImage = useImagePreloader();

  useEffect(() => {
    images.forEach(preloadImage);
  }, [images, preloadImage]);

  return null;
};

// Virtualized image list for large galleries
export const VirtualizedImageList: React.FC<{
  images: Array<{ src: string; alt: string; id: string }>;
  itemHeight: number;
  containerHeight: number;
}> = ({ images, itemHeight, containerHeight }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleCount = Math.ceil(containerHeight / itemHeight) + 2;
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount, images.length);

  const visibleImages = images.slice(startIndex, endIndex);

  const handleScroll = (): void => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  };

  return (
    <div
      ref={containerRef}
      className="overflow-auto"
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: images.length * itemHeight, position: 'relative' }}>
        {visibleImages.map((image, index) => (
          <div
            key={image.id}
            style={{
              position: 'absolute',
              top: (startIndex + index) * itemHeight,
              height: itemHeight,
              width: '100%'
            }}
          >
            <OptimizedImage
              src={image.src}
              alt={image.alt}
              height={itemHeight}
              className="w-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default OptimizedImage;