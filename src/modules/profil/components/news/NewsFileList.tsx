import { FileText } from "lucide-react";

export function NewsFileList({ files }: { files: any[] }) {
  if (!files || files.length === 0) return null;
  return (
    <div className="px-4 sm:px-6 pb-3 w-full">
      <div className="flex flex-col gap-2 w-full">

        {files.map((file, index) => {
          const name = file.name || "Fichier";

          return (
            <a
              key={index}
              href={file.docPath}
              target="_blank"
              rel="noreferrer"
              className="
                cursor-pointer rounded-md border-border bg-muted/50
                p-2 flex items-center w-full flex-wrap
              "
            >
              <FileText className="w-4 h-4 mr-2 shrink-0" />
              <span className="break-all text-sm">
                {name.length > 50 ? name.substring(0, 50) + "..." : name}
              </span>
            </a>
          );
        })}

      </div>
    </div>
  );
}
