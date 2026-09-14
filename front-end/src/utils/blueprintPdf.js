import { detectPdfLots } from "./pdfLotImport";

let pdfLibraryPromise;

export function loadBlueprintPdfLibrary() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfLibraryPromise) return pdfLibraryPromise;
  pdfLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = setTimeout(() => fail(), 20000);
    const fail = () => {
      clearTimeout(timeout);
      script.remove();
      pdfLibraryPromise = null;
      reject(new Error("The PDF reader could not load. Check your connection and try again."));
    };
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
    script.onerror = fail;
    script.onload = () => {
      clearTimeout(timeout);
      if (!window.pdfjsLib) return fail();
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    document.head.appendChild(script);
  });
  return pdfLibraryPromise;
}

export async function prepareBlueprintPdf(file, pageNumber, onProgress) {
  if (file.size > 20 * 1024 * 1024) throw new Error("Choose a PDF smaller than 20 MB.");
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new Error("Enter a valid PDF page number.");
  onProgress("Opening PDF...");
  const pdfjs = await loadBlueprintPdfLibrary();
  const task = pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false });
  try {
    const pdf = await task.promise;
    if (pageNumber > pdf.numPages) throw new Error(`This PDF has ${pdf.numPages} page(s). Choose a page within that range.`);
    const page = await pdf.getPage(pageNumber);
    const unscaled = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(4, 4096 / Math.max(unscaled.width, unscaled.height)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    onProgress("Preparing blueprint...");
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const imageUrl = canvas.toDataURL("image/png");
    onProgress("Detecting lot boundaries...");
    await new Promise((resolve) => setTimeout(resolve, 0));
    let detection;
    try {
      detection = await detectPdfLots(page, pdfjs);
    } catch (error) {
      detection = { candidates: [], warnings: [error.message || "Lot detection failed. You can still align this blueprint and trace lots manually."] };
    }
    return {
      imageUrl,
      lotImport: {
        ...detection,
        sourceName: file.name,
        pageNumber,
        pageCount: pdf.numPages,
        pageWidth: unscaled.width,
        pageHeight: unscaled.height,
        imageWidth: canvas.width,
        imageHeight: canvas.height,
        // PDF viewport pixels are rounded when assigned to canvas dimensions.
        renderWidth: viewport.width,
        renderHeight: viewport.height,
        cropBounds: null,
      },
    };
  } finally {
    await task.destroy();
  }
}
