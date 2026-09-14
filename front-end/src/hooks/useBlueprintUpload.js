import { useEffect, useRef, useState } from "react";
import { prepareBlueprintPdf } from "../utils/blueprintPdf";

export function useBlueprintUpload(onImageUpload) {
  const [uploadStage, setUploadStage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [pdfPage, setPdfPage] = useState(1);
  const mounted = useRef(true);
  const busy = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file || busy.current) return;
    busy.current = true;
    setUploadError("");
    setUploadStage("Opening file...");
    let temporaryUrl;
    try {
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        const result = await prepareBlueprintPdf(file, Number(pdfPage), (stage) => {
          if (mounted.current) setUploadStage(stage);
        });
        if (mounted.current) await onImageUpload(result.imageUrl, result.lotImport);
      } else {
        if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) throw new Error("Choose a PDF, PNG, JPG, or WebP file.");
        if (file.size > 20 * 1024 * 1024) throw new Error("Choose an image smaller than 20 MB.");
        temporaryUrl = URL.createObjectURL(file);
        if (mounted.current) await onImageUpload(temporaryUrl, null);
      }
    } catch (error) {
      if (mounted.current) setUploadError(error.message || "Could not read this file. Please try another PDF or image.");
    } finally {
      if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
      busy.current = false;
      if (mounted.current) setUploadStage("");
    }
  };
  return { uploadStage, uploadError, pdfPage, setPdfPage, handleFileChange };
}
