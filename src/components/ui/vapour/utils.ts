export const calculateVaporizeSpread = (fontSize: number) => {
  const size = typeof fontSize === 'string' ? parseInt(fontSize) : fontSize;

  const points = [
    { size: 20, spread: 0.2 },
    { size: 50, spread: 0.5 },
    { size: 100, spread: 1.5 },
  ];

  if (size <= points[0].size) return points[0].spread;
  if (size >= points[points.length - 1].size) return points[points.length - 1].spread;

  let i = 0;
  while (i < points.length - 1 && points[i + 1].size < size) i++;

  const p1 = points[i];
  const p2 = points[i + 1];

  return p1.spread + ((size - p1.size) * (p2.spread - p1.spread)) / (p2.size - p1.size);
};

export const parseColor = (color: string) => {
  const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, 1)`;
  }

  return 'rgba(0, 0, 0, 1)';
};

export function transformValue(
  input: number,
  inputRange: number[],
  outputRange: number[],
  clamp = false,
): number {
  const [inputMin, inputMax] = inputRange;
  const [outputMin, outputMax] = outputRange;

  const progress = (input - inputMin) / (inputMax - inputMin);
  let result = outputMin + progress * (outputMax - outputMin);

  if (clamp) {
    if (outputMax > outputMin) {
      result = Math.min(Math.max(result, outputMin), outputMax);
    } else {
      result = Math.min(Math.max(result, outputMax), outputMin);
    }
  }

  return result;
}
