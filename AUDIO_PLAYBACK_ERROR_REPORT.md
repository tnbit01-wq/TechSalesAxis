# Audio Playback Error Report: "The play() request was interrupted by a call to pause()"

## Summary
Found **critical autoPlay conflict** in video elements causing browser autoplay policy violations and play/pause race conditions.

---

## 🔴 CRITICAL ISSUES FOUND

### 1. **CompanyCultureGallery - HTML5 Video with autoPlay+controls Conflict**
**File:** [apps/web/src/components/CompanyCultureGallery.tsx](apps/web/src/components/CompanyCultureGallery.tsx#L79-L85)

**Line 79-85:** Lightbox video element with conflicting attributes:
```tsx
{isVideo(selectedMedia) ? (
  <video 
    src={selectedMedia} 
    controls      // HTML5 controls enable player UI
    autoPlay      // ⚠️ Browser autoplay policy conflict
    className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl"
  />
```

**Problem:**
- `autoPlay` attribute triggers browser autoplay policies
- Browser's autoplay restrictions may immediately pause the video
- Race condition: autoPlay initiates play() → browser/policy calls pause()
- **Error:** "The play() request was interrupted by a call to pause()"
- Missing `muted` attribute (required for autoPlay to work in many browsers)

**Root Cause:** Modern browsers require `muted` for autoplay due to autoplay policies that prevent auto-playing audio.

---

### 2. **CompanyCultureGallery - Thumbnail Video Preview Without Controls**
**File:** [apps/web/src/components/CompanyCultureGallery.tsx](apps/web/src/components/CompanyCultureGallery.tsx#L37-L45)

**Line 37-45:** Video element in thumbnail grid:
```tsx
{isVideo(url) ? (
  <div className="w-full h-full flex items-center justify-center bg-slate-900">
    <video src={url} className="w-full h-full object-cover opacity-60" />
    {/* Play overlay icon */}
```

**Problem:**
- Video element without `controls` or `muted` attributes
- Audio tracks may attempt to play automatically
- No user control over playback
- Can trigger same autoplay policy violations

---

### 3. **Assessment Exam - MediaRecorder Audio Handling**
**File:** [apps/web/src/app/assessment/candidate/page.tsx](apps/web/src/app/assessment/candidate/page.tsx#L42-50)

**Line 42-50:** Audio recording implementation:
```typescript
const mediaRecorderRef = useRef<MediaRecorder | null>(null);
const audioChunksRef = useRef<Blob[]>([]);

// State management
const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
const [isRecording, setIsRecording] = useState(false);
```

**Recording Start (Line 167-181):**
```typescript
const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    
    mediaRecorder.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };
    
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      setAudioBlob(audioBlob);
    };
    
    mediaRecorder.start();  // No error handling for playback conflicts
    setIsRecording(true);
```

**Issues:**
- No try-catch around mediaRecorder lifecycle
- Audio stream may have playback state conflicts if previous recording wasn't cleaned up
- Line 193: Stream tracks stopped, but timing could cause play/pause race conditions

**Stop Recording (Line 191-194):**
```typescript
const stopRecording = () => {
  if (mediaRecorderRef.current && isRecording) {
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    setIsRecording(false);
  }
};
```

---

## 📊 AUDIO ELEMENTS IN CODEBASE

### Voice Recognition Hook
**File:** [apps/web/src/hooks/useVoice.ts](apps/web/src/hooks/useVoice.ts)
- Uses `SpeechRecognition` API (not HTML5 audio)
- No direct playback conflicts
- Properly stops listening (line 120-125)

### Video Elements Found
| Component | Location | Issue | Status |
|-----------|----------|-------|--------|
| CompanyCultureGallery | Line 39 (thumbnail) | Missing muted, no controls | 🔴 Active |
| CompanyCultureGallery | Line 80-85 (lightbox) | autoPlay + controls conflict, missing muted | 🔴 **CRITICAL** |
| Assessment Exam | Line 167+ | MediaRecorder stream handling | 🟠 Potential |

---

## 🔧 ROOT CAUSE ANALYSIS

### Browser Autoplay Policy Violation
Modern browsers (Chrome 66+, Firefox, Safari) implement strict autoplay policies:

1. **Autoplay with audio** requires one of:
   - `muted` attribute
   - User gesture (click, tap, etc.)
   - Site permission granted

2. **Current Code Problem:**
   - Video has `autoPlay` ✓
   - Video has `controls` ✓
   - **Missing:** `muted` attribute ✗
   
3. **Result:**
   - Browser blocks autoplay of video with audio
   - Race condition occurs between `autoPlay` and browser's `pause()`
   - Error: "The play() request was interrupted by a call to pause()"

---

## 🚀 SOLUTIONS

### Fix 1: CompanyCultureGallery Lightbox (CRITICAL)
Add `muted` attribute to enable autoplay:
```tsx
<video 
  src={selectedMedia} 
  controls 
  autoPlay 
  muted  // ✅ ADD THIS
  className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl"
/>
```

**OR** Remove `autoPlay` if manual play is acceptable:
```tsx
<video 
  src={selectedMedia} 
  controls 
  className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl"
/>
```

### Fix 2: CompanyCultureGallery Thumbnail Preview
Option A - Silent preview with muted and preload:
```tsx
<video 
  src={url} 
  muted 
  preload="metadata"
  className="w-full h-full object-cover opacity-60" 
/>
```

Option B - No video playback in thumbnail (recommended for performance):
```tsx
<video 
  src={url} 
  muted
  className="w-full h-full object-cover opacity-60" 
  // Remove video on hover, show only on fullscreen
/>
```

### Fix 3: Assessment Exam - MediaRecorder Error Handling
Add proper cleanup and error handling:
```typescript
const stopRecording = () => {
  if (mediaRecorderRef.current) {
    try {
      // Only stop if recording state matches
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      // Clean up all tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => {
        track.stop();
      });
      
      // Clear references
      mediaRecorderRef.current = null;
    } catch (err) {
      console.error("Error stopping recording:", err);
    } finally {
      setIsRecording(false);
    }
  }
};
```

---

## 📋 FILES REQUIRING CHANGES

1. **[apps/web/src/components/CompanyCultureGallery.tsx](apps/web/src/components/CompanyCultureGallery.tsx)**
   - Lines 39-41: Thumbnail video
   - Lines 79-85: Lightbox video

2. **[apps/web/src/app/assessment/candidate/page.tsx](apps/web/src/app/assessment/candidate/page.tsx)**
   - Lines 191-194: stopRecording function

---

## ✅ VERIFICATION STEPS

After applying fixes:

1. **Test CompanyCultureGallery:**
   - Click on company culture media
   - Verify lightbox video loads without console errors
   - Check browser DevTools → Console for "play() interrupted" errors

2. **Test Assessment Exam:**
   - Start recording
   - Stop recording
   - Start recording again (verify no orphaned streams)
   - Submit assessment

3. **Browser Compatibility:**
   - Test Chrome (autoplay policies strictest)
   - Test Firefox and Safari
   - Verify no errors in DevTools Console

---

## 📚 BROWSER AUTOPLAY POLICY REFERENCE

- **MDN:** https://developer.mozilla.org/en-US/docs/Web/Media/Autoplay_guide
- **Chrome Autoplay Policy:** https://developer.chrome.com/blog/autoplay/
- **HTML Video Attributes:** https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video

---

## 🎯 PRIORITY

| Issue | Severity | Impact | Fix Time |
|-------|----------|--------|----------|
| CompanyCultureGallery lightbox | 🔴 HIGH | Media display breaks, user confusion | 5 min |
| CompanyCultureGallery thumbnail | 🟠 MEDIUM | Performance/UX issue | 5 min |
| Assessment recording | 🟡 LOW | Edge case race condition | 10 min |

