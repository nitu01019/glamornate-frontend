import React from 'react';
import { createParticles } from './particle-engine';
import type { Particle, VaporizeTextCycleProps } from './types';
import { parseColor } from './utils';

export const renderCanvas = ({
  framerProps,
  canvasRef,
  wrapperSize,
  particlesRef,
  globalDpr,
  currentTextIndex,
  transformedDensity,
}: {
  framerProps: VaporizeTextCycleProps;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  wrapperSize: { width: number; height: number };
  particlesRef: React.MutableRefObject<Particle[]>;
  globalDpr: number;
  currentTextIndex: number;
  transformedDensity: number;
}) => {
  const canvas = canvasRef.current;
  if (!canvas || !wrapperSize.width || !wrapperSize.height) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = wrapperSize;

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.floor(width * globalDpr);
  canvas.height = Math.floor(height * globalDpr);

  const fontSize = parseInt(framerProps.font?.fontSize?.replace('px', '') || '50');
  const fontStr = `${framerProps.font?.fontWeight ?? 400} ${fontSize * globalDpr}px ${framerProps.font?.fontFamily ?? 'sans-serif'}`;
  const parsedColor = parseColor(framerProps.color ?? 'rgb(153, 153, 153)');

  let textX;
  const textY = canvas.height / 2;
  const currentText = framerProps.texts?.[currentTextIndex] || 'Text';

  if (framerProps.alignment === 'center') {
    textX = canvas.width / 2;
  } else if (framerProps.alignment === 'left') {
    textX = 0;
  } else {
    textX = canvas.width;
  }

  const { particles, textBoundaries } = createParticles(
    ctx,
    canvas,
    currentText,
    textX,
    textY,
    fontStr,
    parsedColor,
    framerProps.alignment || 'left',
    transformedDensity,
  );

  particlesRef.current = particles;
  canvas.textBoundaries = textBoundaries;
};

export const cleanup = ({
  canvasRef,
  particlesRef,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  particlesRef: React.MutableRefObject<Particle[]>;
}) => {
  const canvas = canvasRef.current;
  const ctx = canvas?.getContext('2d');

  if (canvas && ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  if (particlesRef.current) {
    particlesRef.current = [];
  }
};

export const handleFontChange = ({
  currentFont,
  lastFontRef,
  canvasRef,
  wrapperSize,
  particlesRef,
  globalDpr,
  currentTextIndex,
  transformedDensity,
  framerProps,
}: {
  currentFont: string;
  lastFontRef: React.MutableRefObject<string | null>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  wrapperSize: { width: number; height: number };
  particlesRef: React.MutableRefObject<Particle[]>;
  globalDpr: number;
  currentTextIndex: number;
  transformedDensity: number;
  framerProps: VaporizeTextCycleProps;
}) => {
  if (currentFont !== lastFontRef.current) {
    lastFontRef.current = currentFont;

    const timeoutId = setTimeout(() => {
      cleanup({ canvasRef, particlesRef });
      renderCanvas({
        framerProps,
        canvasRef,
        wrapperSize,
        particlesRef,
        globalDpr,
        currentTextIndex,
        transformedDensity,
      });
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
      cleanup({ canvasRef, particlesRef });
    };
  }

  return undefined;
};
