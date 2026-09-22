import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { FileText, Download, Eye, X, Upload } from 'lucide-react';
import { openDataUriInNewTab } from '@/lib/utils';

interface FileUploadFieldProps {
  label: string;
  storedFile: { name: string; dataUri: string } | null;
  isPlainUrl: boolean;
  rawLink?: string;
  canEdit: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}

export function FileUploadField({
  label,
  storedFile,
  isPlainUrl,
  rawLink,
  canEdit,
  inputRef,
  onChange,
  onClear,
}: FileUploadFieldProps) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs font-bold text-muted-foreground">{label}</Label>
      {storedFile ? (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500">
            <FileText size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{storedFile.name}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Uploaded · stored in DB</p>
          </div>
          <button type="button" onClick={() => openDataUriInNewTab(storedFile.dataUri)}
            className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:text-primary/80 uppercase tracking-widest flex-shrink-0">
            <Eye size={12} /> View
          </button>
          <a href={storedFile.dataUri} download={storedFile.name}
            className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest flex-shrink-0">
            <Download size={12} /> Download
          </a>
          {canEdit && (
            <Button type="button" variant="ghost" size="icon"
              className="h-7 w-7 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 rounded-lg flex-shrink-0"
              onClick={onClear}>
              <X size={14} />
            </Button>
          )}
        </div>
      ) : isPlainUrl ? (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
          <div className="flex-1 min-w-0">
            <a href={rawLink} target="_blank" rel="noreferrer"
              className="text-sm font-bold text-primary hover:underline truncate block">
              {rawLink}
            </a>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-0.5">External URL</p>
          </div>
          {canEdit && (
            <Button type="button" variant="ghost" size="icon"
              className="h-7 w-7 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 rounded-lg flex-shrink-0"
              onClick={onClear}>
              <X size={14} />
            </Button>
          )}
        </div>
      ) : canEdit ? (
        <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/40 bg-muted/10 hover:bg-primary/5 transition-colors cursor-pointer group">
          <Upload size={20} className="text-muted-foreground/40 group-hover:text-primary/50 transition-colors" />
          <span className="text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors">
            Click to upload PDF / image
          </span>
          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">Max 5 MB · stored securely in DB</span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={onChange}
          />
        </label>
      ) : null}
    </div>
  );
}
