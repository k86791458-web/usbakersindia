import { useEffect, useRef, useState } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Crop as CropIcon, Pencil, RotateCcw, Check, X } from 'lucide-react';

/**
 * ImageEditor – minimal crop + pen-tool dialog used before sending an image to the backend.
 *
 * Props:
 *   open: boolean
 *   file: File | null            (raw file the user picked)
 *   onCancel(): void
 *   onConfirm(blob: Blob): void  (called with the edited PNG blob)
 */
const ImageEditor = ({ open, file, onCancel, onConfirm }) => {
  const [imgSrc, setImgSrc] = useState('');
  const [mode, setMode] = useState('crop'); // 'crop' | 'pen'
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const [strokeColor, setStrokeColor] = useState('#e92587');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [strokes, setStrokes] = useState([]); // array of arrays of {x,y}
  const drawing = useRef(false);
  const imgRef = useRef(null);
  const drawCanvasRef = useRef(null);

  useEffect(() => {
    if (!file) { setImgSrc(''); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setImgSrc(String(ev.target?.result || ''));
    reader.readAsDataURL(file);
    setStrokes([]);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setMode('crop');
  }, [file]);

  const onImageLoad = (e) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    const c = centerCrop(makeAspectCrop({ unit: '%', width: 90 }, w / h, w, h), w, h);
    setCrop(c);
  };

  // Pen tool — overlay canvas matched to the visible <img>
  const sizeCanvas = () => {
    const img = imgRef.current;
    const cv = drawCanvasRef.current;
    if (!img || !cv) return;
    cv.width = img.clientWidth;
    cv.height = img.clientHeight;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokes.forEach((s) => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    });
  };
  useEffect(() => { if (mode === 'pen') sizeCanvas(); /* eslint-disable-next-line */ }, [mode, strokes, imgSrc]);

  const startDraw = (e) => {
    if (mode !== 'pen') return;
    const r = drawCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    drawing.current = true;
    setStrokes((prev) => [...prev, { color: strokeColor, width: strokeWidth, points: [{ x, y }] }]);
  };
  const moveDraw = (e) => {
    if (!drawing.current) return;
    const r = drawCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    setStrokes((prev) => {
      const copy = prev.slice();
      copy[copy.length - 1] = { ...copy[copy.length - 1], points: [...copy[copy.length - 1].points, { x, y }] };
      return copy;
    });
  };
  const endDraw = () => { drawing.current = false; };
  const undoStroke = () => setStrokes((prev) => prev.slice(0, -1));

  const buildOutputBlob = async () => {
    const img = imgRef.current;
    if (!img) return null;
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;

    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (completedCrop && completedCrop.width && completedCrop.height) {
      sx = completedCrop.x * scaleX;
      sy = completedCrop.y * scaleY;
      sw = completedCrop.width * scaleX;
      sh = completedCrop.height * scaleY;
    }
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(sw));
    out.height = Math.max(1, Math.round(sh));
    const ctx = out.getContext('2d');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);

    // Re-draw strokes scaled to the cropped natural area
    if (strokes.length) {
      const drawnW = img.clientWidth;
      const drawnH = img.clientHeight;
      const xRatio = out.width / (completedCrop?.width || drawnW);
      const yRatio = out.height / (completedCrop?.height || drawnH);
      const xOff = (completedCrop?.x || 0);
      const yOff = (completedCrop?.y || 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      strokes.forEach((s) => {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width * xRatio;
        ctx.beginPath();
        s.points.forEach((p, i) => {
          const x = (p.x - xOff) * xRatio;
          const y = (p.y - yOff) * yRatio;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
    }
    return await new Promise((resolve) => out.toBlob((b) => resolve(b), 'image/png', 0.92));
  };

  const handleConfirm = async () => {
    const blob = await buildOutputBlob();
    if (blob) onConfirm(blob);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Image</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 mb-3">
          <Button
            type="button"
            size="sm"
            variant={mode === 'crop' ? 'default' : 'outline'}
            onClick={() => setMode('crop')}
            data-testid="img-edit-crop-btn"
          >
            <CropIcon className="h-4 w-4 mr-1" /> Crop
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'pen' ? 'default' : 'outline'}
            onClick={() => setMode('pen')}
            data-testid="img-edit-pen-btn"
          >
            <Pencil className="h-4 w-4 mr-1" /> Pen
          </Button>
          {mode === 'pen' && (
            <>
              <Label className="ml-3 text-xs">Color</Label>
              <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} />
              <Label className="ml-2 text-xs">Width</Label>
              <input
                type="range"
                min="1"
                max="20"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(parseInt(e.target.value, 10))}
              />
              <Button type="button" size="sm" variant="outline" onClick={undoStroke}>
                <RotateCcw className="h-4 w-4 mr-1" /> Undo
              </Button>
            </>
          )}
        </div>

        <div className="relative bg-gray-100 rounded overflow-hidden flex items-center justify-center" style={{ minHeight: 300 }}>
          {imgSrc && mode === 'crop' && (
            <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompletedCrop(c)}>
              <img
                ref={imgRef}
                src={imgSrc}
                alt="to-edit"
                onLoad={onImageLoad}
                style={{ maxHeight: '60vh', display: 'block' }}
              />
            </ReactCrop>
          )}
          {imgSrc && mode === 'pen' && (
            <div className="relative">
              <img
                ref={imgRef}
                src={imgSrc}
                alt="to-edit"
                onLoad={sizeCanvas}
                style={{ maxHeight: '60vh', display: 'block', userSelect: 'none' }}
                draggable={false}
              />
              <canvas
                ref={drawCanvasRef}
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                className="absolute inset-0 cursor-crosshair"
              />
            </div>
          )}
        </div>

        <DialogFooter className="mt-3">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="img-edit-cancel">
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="bg-pink-600 text-white hover:bg-pink-700"
            data-testid="img-edit-confirm"
          >
            <Check className="h-4 w-4 mr-1" /> Use This Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageEditor;
