export type BlogSection =
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered?: boolean; items: string[] }
  | { kind: 'callout'; title: string; body: string }
  | { kind: 'image'; src: string; alt: string };

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readMinutes: number;
  heroImage: string;
  publishedAt: string;
  author: string;
  sections: BlogSection[];
  cta: { label: string; href: string };
  relatedSlugs: string[];
  seo: { title: string; description: string; ogImage: string };
}
