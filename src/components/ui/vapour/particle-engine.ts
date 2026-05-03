import type { Particle } from './types';

export const createParticles = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  text: string,
  textX: number,
  textY: number,
  font: string,
  color: string,
  alignment: 'left' | 'center' | 'right',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `_density` is reserved in the signature for the upcoming density-aware particle sampler; keeps the call-site API stable while implementation is staged
  _density: number,
) => {
  const particles: Particle[] = [];

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = alignment;
  ctx.textBaseline = 'middle';
  ctx.imageSmoothingQuality = 'high';
  ctx.imageSmoothingEnabled = true;

  if ('fontKerning' in ctx) {
    (ctx as unknown as Record<string, unknown>).fontKerning = 'normal';
  }

  if ('textRendering' in ctx) {
    (ctx as unknown as Record<string, unknown>).textRendering = 'geometricPrecision';
  }

  const metrics = ctx.measureText(text);
  let textLeft: number;
  const textWidth = metrics.width;

  if (alignment === 'center') {
    textLeft = textX - textWidth / 2;
  } else if (alignment === 'left') {
    textLeft = textX;
  } else {
    textLeft = textX - textWidth;
  }

  const textBoundaries = {
    left: textLeft,
    right: textLeft + textWidth,
    width: textWidth,
  };

  ctx.fillText(text, textX, textY);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const currentDPR = canvas.width / parseInt(canvas.style.width);
  const baseDPR = 3;
  const baseSampleRate = currentDPR / baseDPR;
  const sampleRate = Math.max(1, Math.round(baseSampleRate));

  for (let y = 0; y < canvas.height; y += sampleRate) {
    for (let x = 0; x < canvas.width; x += sampleRate) {
      const index = (y * canvas.width + x) * 4;
      const alpha = data[index + 3];

      if (alpha > 0) {
        const originalAlpha = (alpha / 255) * (sampleRate / currentDPR);
        const particle: Particle = {
          x,
          y,
          originalX: x,
          originalY: y,
          color: `rgba(${data[index]}, ${data[index + 1]}, ${data[index + 2]}, ${originalAlpha})`,
          opacity: originalAlpha,
          originalAlpha,
          velocityX: 0,
          velocityY: 0,
          angle: 0,
          speed: 0,
        };

        particles.push(particle);
      }
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  return { particles, textBoundaries };
};

export const updateParticles = (
  particles: Particle[],
  vaporizeX: number,
  deltaTime: number,
  MULTIPLIED_VAPORIZE_SPREAD: number,
  VAPORIZE_DURATION: number,
  direction: string,
  density: number,
) => {
  let allParticlesVaporized = true;

  particles.forEach((particle) => {
    const shouldVaporize =
      direction === 'left-to-right'
        ? particle.originalX <= vaporizeX
        : particle.originalX >= vaporizeX;

    if (shouldVaporize) {
      if (particle.speed === 0) {
        particle.angle = Math.random() * Math.PI * 2;
        particle.speed = (Math.random() * 1 + 0.5) * MULTIPLIED_VAPORIZE_SPREAD;
        particle.velocityX = Math.cos(particle.angle) * particle.speed;
        particle.velocityY = Math.sin(particle.angle) * particle.speed;
        particle.shouldFadeQuickly = Math.random() > density;
      }

      if (particle.shouldFadeQuickly) {
        particle.opacity = Math.max(0, particle.opacity - deltaTime);
      } else {
        const dx = particle.originalX - particle.x;
        const dy = particle.originalY - particle.y;
        const distanceFromOrigin = Math.sqrt(dx * dx + dy * dy);
        const dampingFactor = Math.max(
          0.95,
          1 - distanceFromOrigin / (100 * MULTIPLIED_VAPORIZE_SPREAD),
        );
        const randomSpread = MULTIPLIED_VAPORIZE_SPREAD * 3;
        const spreadX = (Math.random() - 0.5) * randomSpread;
        const spreadY = (Math.random() - 0.5) * randomSpread;

        particle.velocityX = (particle.velocityX + spreadX + dx * 0.002) * dampingFactor;
        particle.velocityY = (particle.velocityY + spreadY + dy * 0.002) * dampingFactor;

        const maxVelocity = MULTIPLIED_VAPORIZE_SPREAD * 2;
        const currentVelocity = Math.sqrt(
          particle.velocityX * particle.velocityX + particle.velocityY * particle.velocityY,
        );

        if (currentVelocity > maxVelocity) {
          const scale = maxVelocity / currentVelocity;
          particle.velocityX *= scale;
          particle.velocityY *= scale;
        }

        particle.x += particle.velocityX * deltaTime * 20;
        particle.y += particle.velocityY * deltaTime * 10;

        const baseFadeRate = 0.25;
        const durationBasedFadeRate = baseFadeRate * (2000 / VAPORIZE_DURATION);
        particle.opacity = Math.max(0, particle.opacity - deltaTime * durationBasedFadeRate);
      }

      if (particle.opacity > 0.01) {
        allParticlesVaporized = false;
      }
    } else {
      allParticlesVaporized = false;
    }
  });

  return allParticlesVaporized;
};

export const renderParticles = (
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  globalDpr: number,
) => {
  ctx.save();
  ctx.scale(globalDpr, globalDpr);

  particles.forEach((particle) => {
    if (particle.opacity > 0) {
      const pColor = particle.color.replace(/[\d.]+\)$/, `${particle.opacity})`);
      ctx.fillStyle = pColor;
      ctx.fillRect(particle.x / globalDpr, particle.y / globalDpr, 1, 1);
    }
  });

  ctx.restore();
};

export const resetParticles = (particles: Particle[]) => {
  particles.forEach((particle) => {
    particle.x = particle.originalX;
    particle.y = particle.originalY;
    particle.opacity = particle.originalAlpha;
    particle.speed = 0;
    particle.velocityX = 0;
    particle.velocityY = 0;
  });
};
