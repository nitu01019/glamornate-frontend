'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { handleFontChange, renderCanvas } from './vapour/canvas-renderer';
import type { Particle } from './vapour/types';
import { SeoElement } from './vapour/seo-element';
import { Tag, type VaporizeTextCycleProps } from './vapour/types';
import { useIsInView } from './vapour/use-is-in-view';
import { useVapourAnimation } from './vapour/use-vapour-animation';
import { calculateVaporizeSpread, transformValue } from './vapour/utils';

export { Tag };
export type { VaporizeTextCycleProps };

export default function VaporizeTextCycle({
  texts = ['Next.js', 'React'],
  font = {
    fontFamily: 'sans-serif',
    fontSize: '50px',
    fontWeight: 400,
  },
  color = 'rgb(255, 255, 255)',
  spread = 5,
  density = 5,
  animation = {
    vaporizeDuration: 2,
    fadeInDuration: 1,
    waitDuration: 0.5,
  },
  direction = 'left-to-right',
  alignment = 'center',
  tag = Tag.P,
}: VaporizeTextCycleProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const isInView = useIsInView(wrapperRef as React.RefObject<HTMLElement>);
  const lastFontRef = useRef<string | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [wrapperSize, setWrapperSize] = useState({ width: 0, height: 0 });
  const transformedDensity = transformValue(density, [0, 10], [0.3, 1], true);

  const [globalDpr, setGlobalDpr] = useState(1);
  useEffect(() => {
    setGlobalDpr(window.devicePixelRatio * 1.5 || 1);
  }, []);

  const wrapperStyle = useMemo(
    () => ({
      width: '100%',
      height: '100%',
      pointerEvents: 'none' as const,
    }),
    [],
  );

  const canvasStyle = useMemo(
    () => ({
      minWidth: '30px',
      minHeight: '20px',
      pointerEvents: 'none' as const,
    }),
    [],
  );

  const animationDurations = useMemo(
    () => ({
      VAPORIZE_DURATION: (animation.vaporizeDuration ?? 2) * 1000,
      FADE_IN_DURATION: (animation.fadeInDuration ?? 1) * 1000,
      WAIT_DURATION: (animation.waitDuration ?? 0.5) * 1000,
    }),
    [animation.vaporizeDuration, animation.fadeInDuration, animation.waitDuration],
  );

  const fontConfig = useMemo(() => {
    const fontSize = parseInt(font.fontSize?.replace('px', '') || '50');
    const VAPORIZE_SPREAD = calculateVaporizeSpread(fontSize);
    const MULTIPLIED_VAPORIZE_SPREAD = VAPORIZE_SPREAD * spread;
    return {
      fontSize,
      VAPORIZE_SPREAD,
      MULTIPLIED_VAPORIZE_SPREAD,
      font: `${font.fontWeight ?? 400} ${fontSize * globalDpr}px ${font.fontFamily}`,
    };
  }, [font.fontSize, font.fontWeight, font.fontFamily, spread, globalDpr]);

  useVapourAnimation({
    canvasRef,
    particlesRef,
    isInView,
    textsLength: texts.length,
    direction,
    globalDpr,
    MULTIPLIED_VAPORIZE_SPREAD: fontConfig.MULTIPLIED_VAPORIZE_SPREAD,
    VAPORIZE_DURATION: animationDurations.VAPORIZE_DURATION,
    FADE_IN_DURATION: animationDurations.FADE_IN_DURATION,
    WAIT_DURATION: animationDurations.WAIT_DURATION,
    transformedDensity,
    setCurrentTextIndex,
  });

  useEffect(() => {
    renderCanvas({
      framerProps: { texts, font, color, alignment },
      canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
      wrapperSize,
      particlesRef,
      globalDpr,
      currentTextIndex,
      transformedDensity,
    });

    const currentFont = font.fontFamily || 'sans-serif';
    return handleFontChange({
      currentFont,
      lastFontRef,
      canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
      wrapperSize,
      particlesRef,
      globalDpr,
      currentTextIndex,
      transformedDensity,
      framerProps: { texts, font, color, alignment },
    });
  }, [texts, font, color, alignment, wrapperSize, currentTextIndex, globalDpr, transformedDensity]);

  useEffect(() => {
    const container = wrapperRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setWrapperSize({ width, height });
      }

      renderCanvas({
        framerProps: { texts, font, color, alignment },
        canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
        wrapperSize: { width: container.clientWidth, height: container.clientHeight },
        particlesRef,
        globalDpr,
        currentTextIndex,
        transformedDensity,
      });
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `wrapperRef.current` is deliberately the trigger (post-mount DOM ref); the other closed-over values (framerProps, density, etc.) are animation inputs that must NOT re-install the resize observer on every prop change
  }, [wrapperRef.current]);

  useEffect(() => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setWrapperSize({ width: rect.width, height: rect.height });
    }
  }, []);

  return (
    <div ref={wrapperRef} style={wrapperStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />
      <SeoElement tag={tag} texts={texts} />
    </div>
  );
}

VaporizeTextCycle.displayName = 'VaporizeTextCycle';
