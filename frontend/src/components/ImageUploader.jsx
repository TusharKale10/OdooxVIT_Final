import { useRef, useState } from 'react';
import { Upload, Loader2, X, ImageIcon } from 'lucide-react';
import { api } from '../api/client';

export default function ImageUploader({ value, onChange, label = 'Service image' }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const pick = () => ref.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setErr('File too large (max 4 MB).');
      return;
    }
    setBusy(true); setErr('');
    try {
      const d = await api.upload('/uploads', file);
      onChange?.(d.url);
    } catch (e) {
      setErr(e.message || 'Upload failed');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <div>
      <label className="label">{label}</label>
      <div className="card overflow-hidden">
        {value ? (
          <div className="relative aspect-[16/9] bg-ink-100">
            <img src={value} alt="preview" className="w-full h-full object-cover" />
            <button type="button" onClick={() => onChange?.('')}
              className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button type="button" onClick={pick} disabled={busy}
            className="w-full aspect-[16/9] flex flex-col items-center justify-center gap-2 bg-ink-50 hover:bg-ink-100 transition text-ink-500">
            {busy ? <Loader2 size={22} className="animate-spin" /> : <ImageIcon size={28} />}
            <span className="text-xs font-medium">{busy ? 'Uploading…' : 'Click to upload (PNG/JPG, max 4 MB)'}</span>
          </button>
        )}
        <div className="p-3 flex flex-wrap items-center gap-2 border-t border-ink-100">
          <button type="button" onClick={pick} disabled={busy} className="btn-outline !py-1.5 !px-3 text-xs">
            <Upload size={12} /> {value ? 'Replace' : 'Upload file'}
          </button>
          <input
            type="text"
            placeholder="…or paste image URL"
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            className="input !py-1.5 text-xs flex-1 min-w-[140px]"
          />
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onFile} />
      {err && <div className="text-xs text-rose-600 mt-1">{err}</div>}
    </div>
  );
}
