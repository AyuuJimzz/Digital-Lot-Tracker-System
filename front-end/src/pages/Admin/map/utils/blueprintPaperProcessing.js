// Helper: converts Blob/URL to permanent base64 Data URL for persistent IndexedDB storage
export const toDataURL = (urlOrBlob) => {
  return new Promise((resolve) => {
    if (!urlOrBlob) return resolve(urlOrBlob);
    if (typeof urlOrBlob === "string" && urlOrBlob.startsWith("data:")) {
      return resolve(urlOrBlob);
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      try {
        const dataUrl = c.toDataURL("image/png");
        c.width = 0;
        c.height = 0;
        resolve(dataUrl);
      } catch (e) {
        c.width = 0;
        c.height = 0;
        resolve(urlOrBlob);
      }
    };
    img.onerror = () => resolve(urlOrBlob);
    img.src = urlOrBlob;
  });
};

export const generateSourceRevision = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? `rev_${crypto.randomUUID()}`
    : `rev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// Helper: converts paper/transparent background into alpha transparency & CAD lines into chosen high-contrast color, rotated on Canvas, returning a Blob
export const createTransparentPaperBlob = (imageUrl, lineColor = "lime", rotationDeg = 0, lineBoldness = "fine", multiply = true) => {
  return new Promise((resolve) => {
    if (!imageUrl) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const rad = ((rotationDeg || 0) * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rad));
      const cos = Math.abs(Math.cos(rad));

      const w = img.width;
      const h = img.height;
      const newW = Math.max(10, Math.floor(w * cos + h * sin));
      const newH = Math.max(10, Math.floor(w * sin + h * cos));

      canvas.width = newW;
      canvas.height = newH;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.translate(newW / 2, newH / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -w / 2, -h / 2);

      try {
        if (multiply) {
          const imgData = ctx.getImageData(0, 0, newW, newH);
          const data = imgData.data;

          // Color selection (default to Lime)
          let targetR = 52, targetG = 211, targetB = 153;
          if (lineColor === "amber" || lineColor === "gold" || lineColor === "yellow") {
            targetR = 251; targetG = 191; targetB = 36;
          } else if (lineColor === "cyan" || lineColor === "blue") {
            targetR = 6; targetG = 182; targetB = 212;
          } else if (lineColor === "lime" || lineColor === "green") {
            targetR = 52; targetG = 211; targetB = 153;
          } else if (lineColor === "white") {
            targetR = 255; targetG = 255; targetB = 255;
          } else if (lineColor === "black") {
            targetR = 15; targetG = 23; targetB = 42;
          }

          const isDarkInk = lineColor === "black";

          // Smooth paper cutoff and curve exponent
          let paperThreshold = 225;
          let exponent = 2.0;
          if (lineBoldness === "super_fine") {
            paperThreshold = 210;
            exponent = 2.4;
          } else if (lineBoldness === "fine") {
            paperThreshold = 225;
            exponent = 1.7;
          } else if (lineBoldness === "normal") {
            paperThreshold = 235;
            exponent = 1.2;
          } else {
            paperThreshold = 245;
            exponent = 0.8;
          }

          // Large saved blueprints can contain millions of pixels. Give camera
          // rendering and input a turn instead of processing them in one task.
          let sliceStarted = performance.now();
          for (let i = 0; i < data.length; i += 4) {
            if (i % 65536 === 0 && performance.now() - sliceStarted >= 4) {
              await new Promise((resume) => setTimeout(resume, 0));
              sliceStarted = performance.now();
            }
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a < 20) {
              data[i + 3] = 0;
              continue;
            }

            const lum = (r + g + b) / 3;

            if (lum >= paperThreshold) {
              data[i + 3] = 0; // 100% transparent background
            } else if (!isDarkInk) {
              const norm = (paperThreshold - lum) / paperThreshold; // 0 to 1
              // Cubic Hermite smoothstep for anti-aliasing without blur or stair-steps
              const smoothStep = norm * norm * (3 - 2 * norm);
              const alpha = Math.min(255, Math.max(0, Math.pow(smoothStep, exponent) * 255));

              data[i] = targetR;
              data[i + 1] = targetG;
              data[i + 2] = targetB;
              data[i + 3] = Math.round(alpha);
            }
          }

          // Dilation / Stroke Thickening Pass: only active when user explicitly chooses "bold"
          if (!isDarkInk && lineBoldness === "bold") {
            const copy = new Uint8ClampedArray(data);
            for (let y = 1; y < newH - 1; y++) {
              if (performance.now() - sliceStarted >= 4) {
                await new Promise((resume) => setTimeout(resume, 0));
                sliceStarted = performance.now();
              }
              for (let x = 1; x < newW - 1; x++) {
                const idx = (y * newW + x) * 4;
                if (copy[idx + 3] < 50) {
                  const topA = copy[((y - 1) * newW + x) * 4 + 3];
                  const btmA = copy[((y + 1) * newW + x) * 4 + 3];
                  const lftA = copy[(y * newW + (x - 1)) * 4 + 3];
                  const rgtA = copy[(y * newW + (x + 1)) * 4 + 3];
                  if (topA > 200 || btmA > 200 || lftA > 200 || rgtA > 200) {
                    data[idx] = targetR;
                    data[idx + 1] = targetG;
                    data[idx + 2] = targetB;
                    data[idx + 3] = 200;
                  }
                }
              }
            }
          }

          ctx.putImageData(imgData, 0, 0);
        }
      } catch (e) {}

      canvas.toBlob((blob) => {
        canvas.width = 0;
        canvas.height = 0;
        resolve(blob || null);
      }, "image/png");
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
};

// Compatibility wrapper preserving the existing string URL return contract for all callers
export const createTransparentPaperImage = async (imageUrl, lineColor = "lime", rotationDeg = 0, lineBoldness = "fine", multiply = true) => {
  const blob = await createTransparentPaperBlob(imageUrl, lineColor, rotationDeg, lineBoldness, multiply);
  return blob ? URL.createObjectURL(blob) : imageUrl;
};
