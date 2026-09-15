import { toPng } from "html-to-image";

export async function captureNodePng(node: HTMLElement): Promise<string> {
  return toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#ffffff",
    filter: (element) => {
      if (!(element instanceof HTMLElement)) return true;
      return element.dataset.captureHide !== "true";
    },
  });
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
