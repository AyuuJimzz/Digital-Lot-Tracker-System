import { act, renderHook } from "@testing-library/react";
import { prepareBlueprintPdf } from "../utils/blueprintPdf";
import { useBlueprintUpload } from "./useBlueprintUpload";

jest.mock("../utils/blueprintPdf", () => ({ prepareBlueprintPdf: jest.fn() }));

test("passes the cropped overlay and full original PDF page separately", async () => {
  prepareBlueprintPdf.mockResolvedValue({
    imageUrl: "data:image/png;base64,cropped",
    originalImageUrl: "data:image/png;base64,original",
    lotImport: { candidates: [{ id: "lot-1" }] },
  });
  const onImageUpload = jest.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useBlueprintUpload(onImageUpload));
  const file = new File(["pdf"], "plan.pdf", { type: "application/pdf" });

  await act(async () => {
    await result.current.handleFileChange({ target: { files: [file], value: "plan.pdf" } });
  });

  expect(onImageUpload).toHaveBeenCalledWith(
    "data:image/png;base64,cropped",
    { candidates: [{ id: "lot-1" }] },
    "data:image/png;base64,original",
  );
});
