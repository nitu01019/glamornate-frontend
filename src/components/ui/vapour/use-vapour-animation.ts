import React, { useCallback, useEffect, useRef, useState } from 'react';
import { renderParticles, resetParticles, updateParticles } from './particle-engine';
import type { Particle } from './types';

type AnimationState = 'static' | 'vaporizing' | 'fadingIn' | 'waiting';

interface UseVapourAnimationArgs {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  particlesRef: React.MutableRefObject<Particle[]>;
  isInView: boolean;
  textsLength: number;
  direction: 'left-to-right' | 'right-to-left';
  globalDpr: number;
  MULTIPLIED_VAPORIZE_SPREAD: number;
  VAPORIZE_DURATION: number;
  FADE_IN_DURATION: number;
  WAIT_DURATION: number;
  transformedDensity: number;
  setCurrentTextIndex: React.Dispatch<React.SetStateAction<number>>;
}

/**
 * Drives the vaporize / fade-in / wait animation loop via requestAnimationFrame.
 * State machine mirrors the original component's inline useEffect — preserved
 * dependency array verbatim. `animationState` is returned so the caller can
 * observe the phase, but the loop is self-contained.
 */
export function useVapourAnimation({
  canvasRef,
  particlesRef,
  isInView,
  textsLength,
  direction,
  globalDpr,
  MULTIPLIED_VAPORIZE_SPREAD,
  VAPORIZE_DURATION,
  FADE_IN_DURATION,
  WAIT_DURATION,
  transformedDensity,
  setCurrentTextIndex,
}: UseVapourAnimationArgs) {
  const [animationState, setAnimationState] = useState<AnimationState>('static');
  const vaporizeProgressRef = useRef(0);
  const fadeOpacityRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  const memoizedUpdateParticles = useCallback(
    (particles: Particle[], vaporizeX: number, deltaTime: number) => {
      return updateParticles(
        particles,
        vaporizeX,
        deltaTime,
        MULTIPLIED_VAPORIZE_SPREAD,
        VAPORIZE_DURATION,
        direction,
        transformedDensity,
      );
    },
    [MULTIPLIED_VAPORIZE_SPREAD, VAPORIZE_DURATION, direction, transformedDensity],
  );

  const memoizedRenderParticles = useCallback(
    (ctx: CanvasRenderingContext2D, particles: Particle[]) => {
      renderParticles(ctx, particles, globalDpr);
    },
    [globalDpr],
  );

  // Start/stop based on isInView
  useEffect(() => {
    if (isInView) {
      const startAnimationTimeout = setTimeout(() => {
        setAnimationState('vaporizing');
      }, 0);
      return () => clearTimeout(startAnimationTimeout);
    } else {
      setAnimationState('static');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  }, [isInView]);

  // Main animation loop
  useEffect(() => {
    if (!isInView) return;

    let lastTime = performance.now();
    let frameId: number;

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');

      if (!canvas || !ctx || !particlesRef.current.length) {
        frameId = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      switch (animationState) {
        case 'static': {
          memoizedRenderParticles(ctx, particlesRef.current);
          break;
        }
        case 'vaporizing': {
          vaporizeProgressRef.current += (deltaTime * 100) / (VAPORIZE_DURATION / 1000);

          const textBoundaries = canvas.textBoundaries;
          if (!textBoundaries) break;

          const progress = Math.min(100, vaporizeProgressRef.current);
          const vaporizeX =
            direction === 'left-to-right'
              ? textBoundaries.left + (textBoundaries.width * progress) / 100
              : textBoundaries.right - (textBoundaries.width * progress) / 100;

          const allVaporized = memoizedUpdateParticles(particlesRef.current, vaporizeX, deltaTime);
          memoizedRenderParticles(ctx, particlesRef.current);

          if (vaporizeProgressRef.current >= 100 && allVaporized) {
            setCurrentTextIndex((prevIndex) => (prevIndex + 1) % textsLength);
            setAnimationState('fadingIn');
            fadeOpacityRef.current = 0;
          }
          break;
        }
        case 'fadingIn': {
          fadeOpacityRef.current += (deltaTime * 1000) / FADE_IN_DURATION;

          ctx.save();
          ctx.scale(globalDpr, globalDpr);
          particlesRef.current.forEach((particle) => {
            particle.x = particle.originalX;
            particle.y = particle.originalY;
            const opacity = Math.min(fadeOpacityRef.current, 1) * particle.originalAlpha;
            const pColor = particle.color.replace(/[\d.]+\)$/, `${opacity})`);
            ctx.fillStyle = pColor;
            ctx.fillRect(particle.x / globalDpr, particle.y / globalDpr, 1, 1);
          });
          ctx.restore();

          if (fadeOpacityRef.current >= 1) {
            setAnimationState('waiting');
            setTimeout(() => {
              setAnimationState('vaporizing');
              vaporizeProgressRef.current = 0;
              resetParticles(particlesRef.current);
            }, WAIT_DURATION);
          }
          break;
        }
        case 'waiting': {
          memoizedRenderParticles(ctx, particlesRef.current);
          break;
        }
      }

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [
    animationState,
    isInView,
    textsLength,
    direction,
    globalDpr,
    memoizedUpdateParticles,
    memoizedRenderParticles,
    FADE_IN_DURATION,
    WAIT_DURATION,
    VAPORIZE_DURATION,
    canvasRef,
    particlesRef,
    setCurrentTextIndex,
  ]);

  return { animationState };
}
