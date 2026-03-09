import { useCallback, useEffect, useRef, useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { initAdminAuth, storage } from "@/utils/firebase";
import { Loader2, Upload, X } from "lucide-react"; 

interface ImageUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  urgent: boolean;
  disabled?: boolean;
}

export function ImageUploader({ value, onChange, urgent, disabled }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    initAdminAuth();
  }, []);

  const processFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || disabled) return; 

      setUploading(true);
      const uploadPromises = Array.from(files).map(async (file) => {
        if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024) {
          console.error(`${file.name} is too large or not an image.`);
          return null;
        }

        try {
          const storageRef = ref(storage, `uploads/${Date.now()}-${file.name}`);
          
          const snapshot = await uploadBytes(storageRef, file);
          
          // Get the permanent URL
          return await getDownloadURL(snapshot.ref);
        } catch (error) {
          console.error("Upload failed:", error);
          return null;
        }
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const validUrls = uploadedUrls.filter((url): url is string => url !== null);
      
      onChange([...value, ...validUrls]);
      setUploading(false);
    },
    [value, onChange, disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      setDragging(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles, disabled]
  );

  const remove = (i: number) => {
    if (disabled) return;
    onChange(value.filter((_, idx) => idx !== i));
  };

  // Dynamic Styles
  const accentBorder = urgent ? "border-destructive bg-destructive/5" : "border-primary bg-primary/5";
  const idleBorder = urgent ? "border-destructive/30 hover:border-destructive/50" : "border-muted-foreground/25 hover:border-primary/50";

  return (
    <div className="space-y-4">
      {!disabled && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-all ${
            dragging ? accentBorder : idleBorder
          } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className={`rounded-full p-2.5 ${urgent ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">
              {uploading ? "Uploading to Firebase..." : "Click to upload or drag and drop"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Max. 4MB per image</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={uploading || disabled}
            className="hidden"
            onChange={(e) => processFiles(e.target.files)}
          />
        </div>
      )}

      {/* Image Grid Display */}
      {value.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {value.map((url, i) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-md border shadow-sm">
              <img src={url} alt="Upload" className="h-full w-full object-cover" />
              
              {/* Conditionally render the remove button only if NOT disabled */}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-destructive opacity-0 backdrop-blur-sm transition-all group-hover:opacity-100 hover:bg-destructive hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Fallback if disabled and no images exist */
        disabled && (
          <div className="rounded-md border border-dashed p-4 text-center">
            <p className="text-sm text-muted-foreground italic">No images provided.</p>
          </div>
        )
      )}
    </div>
  );
}