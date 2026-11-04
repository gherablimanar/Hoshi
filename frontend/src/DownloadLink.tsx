import type { AnchorHTMLAttributes } from "react";
import { apiUrl, downloadFile } from "./api";
export function DownloadLink({
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...props}
      href={href ? apiUrl(href) : undefined}
      onClick={(e) => {
        e.preventDefault();
        if (!href) return;
        void downloadFile(href).catch((error) =>
          window.dispatchEvent(
            new CustomEvent("engine-download-error", { detail: error.message }),
          ),
        );
      }}
    />
  );
}
