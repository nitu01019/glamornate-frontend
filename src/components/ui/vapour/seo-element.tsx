import { createElement, memo, useMemo } from 'react';
import { Tag } from './types';

export const SeoElement = memo(function SeoElement({
  tag = Tag.P,
  texts,
}: {
  tag: Tag;
  texts: string[];
}) {
  const style = useMemo(
    () => ({
      position: 'absolute' as const,
      width: '0',
      height: '0',
      overflow: 'hidden',
      userSelect: 'none' as const,
      pointerEvents: 'none' as const,
    }),
    [],
  );

  const safeTag = Object.values(Tag).includes(tag) ? tag : 'p';
  return createElement(safeTag, { style }, texts?.join(' ') ?? '');
});

SeoElement.displayName = 'SeoElement';
