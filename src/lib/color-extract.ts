/**
 * Extract dominant colors from an image using Canvas API.
 * Client-side only — requires browser environment.
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

function rgbToHex({ r, g, b }: RGB): string {
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function luminance({ r, g, b }: RGB): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Extract the top N dominant colors from an image URL.
 * Uses k-means-style clustering on sampled pixels.
 *
 * @returns Array of hex color strings, sorted by dominance
 */
export async function extractColors(imageUrl: string, count: number = 3): Promise<string[]> {
  const img = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return ["#2563eb"];

  // Scale down for performance
  const maxSize = 100;
  const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
  canvas.width = Math.floor(img.width * scale);
  canvas.height = Math.floor(img.height * scale);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  // Sample pixels, filtering out near-white, near-black, and transparent
  const samples: RGB[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    if (a < 128) continue; // Skip transparent
    const lum = luminance({ r, g, b });
    if (lum > 240 || lum < 15) continue; // Skip near-white/black

    samples.push({ r, g, b });
  }

  if (samples.length === 0) return ["#2563eb"];

  // Simple k-means clustering
  const clusters = kMeans(samples, Math.min(count, samples.length));

  // Sort by cluster size (most dominant first), then filter out very similar colors
  const sorted = clusters
    .sort((a, b) => b.count - a.count)
    .map((c) => c.center);

  // Deduplicate close colors
  const result: RGB[] = [sorted[0]];
  for (let i = 1; i < sorted.length && result.length < count; i++) {
    const tooClose = result.some((existing) => colorDistance(existing, sorted[i]) < 50);
    if (!tooClose) result.push(sorted[i]);
  }

  return result.map(rgbToHex);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

interface Cluster {
  center: RGB;
  count: number;
}

function kMeans(pixels: RGB[], k: number, iterations: number = 10): Cluster[] {
  // Initialize centers by picking evenly spaced samples
  const step = Math.max(1, Math.floor(pixels.length / k));
  let centers: RGB[] = [];
  for (let i = 0; i < k; i++) {
    centers.push({ ...pixels[Math.min(i * step, pixels.length - 1)] });
  }

  for (let iter = 0; iter < iterations; iter++) {
    // Assign pixels to nearest center
    const groups: RGB[][] = centers.map(() => []);
    for (const pixel of pixels) {
      let minDist = Infinity;
      let minIdx = 0;
      for (let c = 0; c < centers.length; c++) {
        const d = colorDistance(pixel, centers[c]);
        if (d < minDist) {
          minDist = d;
          minIdx = c;
        }
      }
      groups[minIdx].push(pixel);
    }

    // Recompute centers
    for (let c = 0; c < centers.length; c++) {
      if (groups[c].length === 0) continue;
      const sum = groups[c].reduce(
        (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }),
        { r: 0, g: 0, b: 0 }
      );
      centers[c] = {
        r: Math.round(sum.r / groups[c].length),
        g: Math.round(sum.g / groups[c].length),
        b: Math.round(sum.b / groups[c].length),
      };
    }
  }

  // Return clusters with counts
  const groups: RGB[][] = centers.map(() => []);
  for (const pixel of pixels) {
    let minDist = Infinity;
    let minIdx = 0;
    for (let c = 0; c < centers.length; c++) {
      const d = colorDistance(pixel, centers[c]);
      if (d < minDist) {
        minDist = d;
        minIdx = c;
      }
    }
    groups[minIdx].push(pixel);
  }

  return centers.map((center, i) => ({ center, count: groups[i].length }));
}
