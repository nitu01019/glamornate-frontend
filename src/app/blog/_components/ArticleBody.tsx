import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import type { BlogSection } from '@/data/blog/types';

interface ArticleBodyProps {
  readonly sections: readonly BlogSection[];
}

interface SectionProps {
  readonly section: BlogSection;
  readonly index: number;
}

function SectionRenderer({ section, index }: SectionProps): JSX.Element | null {
  switch (section.kind) {
    case 'heading': {
      if (section.level === 2) {
        return (
          <h2 key={index} className="text-lg font-bold text-gray-900 mt-6 mb-2">
            {section.text}
          </h2>
        );
      }
      return (
        <h3 key={index} className="text-base font-semibold text-gray-800 mt-5 mb-1.5">
          {section.text}
        </h3>
      );
    }
    case 'paragraph': {
      return (
        <p key={index} className="text-sm text-gray-700 leading-relaxed mb-3">
          {section.text}
        </p>
      );
    }
    case 'list': {
      const items = section.items.map((item, itemIdx) => (
        <li key={itemIdx} className="text-sm text-gray-700 leading-relaxed">
          {item}
        </li>
      ));
      if (section.ordered === true) {
        return (
          <ol
            key={index}
            className="list-decimal pl-5 space-y-1.5 mb-4 marker:text-brand-maroon-400"
          >
            {items}
          </ol>
        );
      }
      return (
        <ul key={index} className="list-disc pl-5 space-y-1.5 mb-4 marker:text-brand-maroon-400">
          {items}
        </ul>
      );
    }
    case 'callout': {
      return (
        <aside
          key={index}
          className="rounded-2xl bg-brand-maroon-50 border border-brand-maroon-100 p-4 my-4"
          role="note"
        >
          <div className="flex items-start gap-2">
            <Sparkles
              className="w-4 h-4 text-brand-maroon-500 mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            <div>
              <h4 className="text-sm font-semibold text-brand-maroon-700 mb-1">{section.title}</h4>
              <p className="text-sm text-brand-maroon-700/90 leading-relaxed">{section.body}</p>
            </div>
          </div>
        </aside>
      );
    }
    case 'image': {
      return (
        <figure key={index} className="my-4">
          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100">
            <Image
              src={section.src}
              alt={section.alt}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </div>
          {section.alt.length > 0 && (
            <figcaption className="text-xs text-gray-400 mt-1.5 text-center">
              {section.alt}
            </figcaption>
          )}
        </figure>
      );
    }
    default: {
      return null;
    }
  }
}

export function ArticleBody({ sections }: ArticleBodyProps): JSX.Element {
  return (
    <div className="prose-article">
      {sections.map((section, index) => (
        <SectionRenderer key={`${section.kind}-${index}`} section={section} index={index} />
      ))}
    </div>
  );
}
