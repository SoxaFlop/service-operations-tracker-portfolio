import { useRef, useEffect, useCallback, useState } from 'react';
import { Bold, Italic, Underline, Type, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

function plainToHtml(text: string): string {
  if (!text || text.trim().startsWith('<')) return text;
  return text.split('\n').map(l => `<p>${l || '<br>'}</p>`).join('');
}

interface SignatureEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function SignatureEditor({ value, onChange, placeholder = 'Kind regards,\nYour Name\nExample Company' }: SignatureEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const prevRef = useRef('');
  const isFocused = useRef(false);
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [imgWidth, setImgWidth] = useState(300);
  const [imgMaxWidth, setImgMaxWidth] = useState(800);

  useEffect(() => {
    if (editorRef.current && !isFocused.current) {
      const html = plainToHtml(value);
      if (html !== editorRef.current.innerHTML) {
        prevRef.current = html;
        editorRef.current.innerHTML = html;
      }
    }
  }, [value]);

  const exec = useCallback((cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    const html = editorRef.current?.innerHTML ?? '';
    prevRef.current = html;
    onChange(html);
  }, [onChange]);

  // execCommand('fontSize') only accepts 1–7; workaround: stamp size="7" then replace with px span
  const applyFontSize = useCallback((px: number) => {
    editorRef.current?.focus();
    document.execCommand('fontSize', false, '7');
    const editor = editorRef.current;
    if (!editor) return;
    editor.querySelectorAll('font[size="7"]').forEach(font => {
      const span = document.createElement('span');
      span.style.fontSize = `${px}px`;
      span.innerHTML = (font as HTMLElement).innerHTML;
      font.parentNode?.replaceChild(span, font);
    });
    const html = editor.innerHTML ?? '';
    prevRef.current = html;
    onChange(html);
  }, [onChange]);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      // Resize to max 800×600 before storing to keep the database row compact.
      const MAX_W = 800, MAX_H = 600;
      const ratio = Math.min(MAX_W / img.naturalWidth, MAX_H / img.naturalHeight);
      const w = Math.round(img.naturalWidth * ratio);
      const h = Math.round(img.naturalHeight * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const fmt = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(fmt, 0.85);
      // Display at 300px wide; slider lets user resize up to 800px via CSS (may soften if source was smaller)
      exec('insertHTML', `<img src="${dataUrl}" style="width:300px;height:auto;vertical-align:middle" />`);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); toast.error('Could not load image'); };
    img.src = objectUrl;
    e.target.value = '';
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      setSelectedImg(img);
      const currentW = img.style.width ? parseInt(img.style.width) : (img.offsetWidth || 300);
      setImgWidth(currentW);
      setImgMaxWidth(800);
    } else {
      setSelectedImg(null);
    }
  };

  const handleWidthChange = (w: number) => {
    setImgWidth(w);
    if (selectedImg) {
      selectedImg.style.width = `${w}px`;
      selectedImg.style.height = 'auto';
      const html = editorRef.current?.innerHTML ?? '';
      prevRef.current = html;
      onChange(html);
    }
  };

  const tb = 'text-xs px-2 py-1 rounded-lg hover:bg-muted/60 transition-colors border border-transparent hover:border-border flex items-center justify-center';

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-background">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/20 border-b border-border flex-wrap">
        <select
          defaultValue="sans-serif"
          onChange={e => exec('fontName', e.target.value)}
          className="text-xs rounded-lg px-2 py-1 border border-border bg-background hover:bg-muted/30 cursor-pointer h-7"
        >
          <option value="sans-serif">Sans-serif</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="Verdana, sans-serif">Verdana</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="'Courier New', monospace">Monospace</option>
        </select>
        <select
          defaultValue="14"
          onChange={e => applyFontSize(Number(e.target.value))}
          className="text-xs rounded-lg px-2 py-1 border border-border bg-background hover:bg-muted/30 cursor-pointer h-7"
        >
          <option value="10">10px</option>
          <option value="11">11px</option>
          <option value="12">12px</option>
          <option value="13">13px</option>
          <option value="14">14px</option>
          <option value="16">16px</option>
          <option value="18">18px</option>
          <option value="20">20px</option>
          <option value="24">24px</option>
          <option value="28">28px</option>
          <option value="32">32px</option>
        </select>
        <div className="w-px h-4 bg-border mx-0.5" />
        <button type="button" onClick={() => exec('bold')} className={tb} title="Bold"><Bold size={13} /></button>
        <button type="button" onClick={() => exec('italic')} className={tb} title="Italic"><Italic size={13} /></button>
        <button type="button" onClick={() => exec('underline')} className={tb} title="Underline"><Underline size={13} /></button>
        <div className="w-px h-4 bg-border mx-0.5" />
        <label className={`${tb} cursor-pointer gap-1`} title="Text colour">
          <Type size={13} />
          <input
            type="color"
            defaultValue="#111827"
            onChange={e => exec('foreColor', e.target.value)}
            className="w-0 h-0 opacity-0 absolute"
          />
        </label>
        <button type="button" onClick={() => imgInputRef.current?.click()} className={`${tb} gap-1`} title="Insert image">
          <ImageIcon size={13} />
          <span>Img</span>
        </button>
        <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />

        {selectedImg && (
          <>
            <div className="w-px h-4 bg-border mx-0.5" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-medium">Size:</span>
              <input
                type="range"
                min={20}
                max={Math.max(imgMaxWidth, imgWidth)}
                value={imgWidth}
                onChange={e => handleWidthChange(Number(e.target.value))}
                className="w-24 accent-indigo-500 cursor-pointer"
                style={{ height: '4px' }}
              />
              <span className="text-[10px] font-mono text-muted-foreground w-10">{imgWidth}px</span>
            </div>
          </>
        )}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => { isFocused.current = true; }}
        onBlur={() => { isFocused.current = false; }}
        onClick={handleEditorClick}
        onInput={() => {
          const html = editorRef.current?.innerHTML ?? '';
          prevRef.current = html;
          onChange(html);
        }}
        className="p-3 text-sm focus:outline-none overflow-auto"
        style={{ minHeight: '96px', resize: 'vertical' }}
        data-placeholder={placeholder}
      />
      {selectedImg && (
        <p className="px-3 py-1.5 text-[10px] text-muted-foreground/60 border-t border-border bg-muted/10">
          Click elsewhere to deselect image
        </p>
      )}
    </div>
  );
}
