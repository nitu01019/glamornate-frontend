import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllSlugs, getPostBySlug, getRelatedPosts } from '@/data/blog';
import { PageClient } from './PageClient';

interface RouteParams {
  readonly slug: string;
}

interface RouteProps {
  readonly params: Promise<RouteParams>;
}

export async function generateStaticParams(): Promise<RouteParams[]> {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: 'Post not found',
      description: 'The article you are looking for could not be found.',
    };
  }

  return {
    title: post.seo.title,
    description: post.seo.description,
    openGraph: {
      title: post.seo.title,
      description: post.seo.description,
      type: 'article',
      images: [post.seo.ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.seo.title,
      description: post.seo.description,
      images: [post.seo.ogImage],
    },
  };
}

export default async function BlogPostPage({ params }: RouteProps): Promise<JSX.Element> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const related = getRelatedPosts(slug, 3);

  return <PageClient post={post} related={related} />;
}
