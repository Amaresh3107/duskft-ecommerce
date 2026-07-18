import { useRef, useState } from 'react';
import { X, GripVertical, Upload } from 'lucide-react';
import { API, resolveImageUrl } from '../../lib/api';
import { adminAuthHeaders } from '../../context/AdminAuthContext';
import { toast } from '../ui/sonner';

// `value` is always an array of URL strings, even when `multiple` is false
// (single-image callers just read value[0]).
export function ImageUploader({ value = [], onChange, multiple = true }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const dragIndex = useRef(null);

  const uploadFiles = async (files) => {
    const list = multiple ? Array.from(files) : [files[0]];
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of list) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API}/uploads/image`, {
          method: 'POST',
          headers: adminAuthHeaders(),
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Upload failed');
        uploaded.push(data.url);
      }
      onChange(multiple ? [...value, ...uploaded] : uploaded);
    } catch (err) {
      toast.error(typeof err.message === 'string' ? err.message : 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  };

  const remove = (idx) => onChange(value.filter((_, i) => i !== idx));

  const reorder = (from, to) => {
    if (from === to) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-center text-xs transition-colors ${
          dragOver ? 'border-[#0B132B] bg-black/5' : 'border-gray-300 text-[#5E6A7D] hover:border-gray-400'
        }`}
      >
        <Upload size={18} className="mb-1" />
        {uploading ? 'Uploading...' : 'Drag & drop image(s) here, or click to browse'}
        <span className="mt-0.5 text-[10px] text-[#B7BFC9]">JPEG, PNG, WEBP, or GIF — up to 5MB each</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple={multiple}
          className="hidden"
          onChange={(e) => e.target.files?.length && uploadFiles(e.target.files)}
        />
      </div>

      {value.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {value.map((url, i) => (
            <div
              key={url + i}
              draggable={multiple}
              onDragStart={() => (dragIndex.current = i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { reorder(dragIndex.current, i); dragIndex.current = null; }}
              className="group relative aspect-square overflow-hidden rounded-md border border-gray-200"
            >
              <img src={resolveImageUrl(url)} alt="" className="h-full w-full object-cover" />
              {multiple && (
                <div className="absolute left-1 top-1 rounded bg-black/50 p-0.5 text-white opacity-0 group-hover:opacity-100">
                  <GripVertical size={12} />
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 hover:bg-red-500 group-hover:opacity-100"
              >
                <X size={12} />
              </button>
              {i === 0 && multiple && (
                <span className="absolute bottom-1 left-1 rounded bg-white/90 px-1 text-[9px] font-medium">Cover</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
