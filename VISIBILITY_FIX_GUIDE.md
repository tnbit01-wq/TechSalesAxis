// VISIBILITY FIX: Add to CareerReadinessFlow.tsx

// STEP 1: Ensure bot message text is explicitly dark
// FILE: apps/web/src/components/CareerReadinessFlow.tsx (around Line 668)

// CURRENT CODE (might have visibility issue):
/*
<div className={`px-5 py-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
  msg.sender === "user"
    ? "bg-primary text-white rounded-tr-none shadow-primary-light font-semibold"
    : "bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-none font-medium"
}`}>
  {msg.text}
</div>
*/

// FIXED CODE (with explicit color fallback):
/*
<div className={`px-5 py-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
  msg.sender === "user"
    ? "bg-primary text-white rounded-tr-none shadow-primary-light font-semibold"
    : "bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-none font-medium"
}`}
style={msg.sender === "bot" ? {
  color: "#374151",  // Explicit dark gray (slate-700 equivalent)
  backgroundColor: "#f8fafc"  // Explicit light gray (slate-50 equivalent)
} : {}}>
  {msg.text}
</div>
*/

// STEP 2: Ensure button options are visible
// FILE: apps/web/src/components/CareerReadinessFlow.tsx (around Line 689)

// CURRENT CODE:
/*
<button className="px-5 py-2.5 bg-white hover:bg-primary-light border border-slate-200 hover:border-primary-light rounded-full text-sm font-semibold text-slate-800 hover:text-primary transition-all shadow-sm active:scale-95 disabled:opacity-50">
  {option}
</button>
*/

// FIXED CODE (with explicit fallback colors):
/*
<button 
  className="px-5 py-2.5 bg-white hover:bg-primary-light border border-slate-200 hover:border-primary-light rounded-full text-sm font-semibold text-slate-800 hover:text-primary transition-all shadow-sm active:scale-95 disabled:opacity-50"
  style={{
    color: "#1f2937",  // Explicit dark gray (text-slate-800 equivalent)
    backgroundColor: "#ffffff",  // Explicit white
    borderColor: "#e2e8f0"  // Explicit light border
  }}>
  {option}
</button>
*/

// STEP 3: Fix primary color definition
// FILE: apps/web/src/app/globals.css

// Add at the beginning after @import "tailwindcss";
/*
@theme {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  
  /* EXPLICIT COLOR DEFINITIONS */
  --color-primary: #3b82f6;          /* Blue (user message background) */
  --color-primary-light: #dbeafe;    /* Light blue (hover state) */
  --color-primary-dark: #1d4ed8;     /* Dark blue (active state) */
  --color-slate-50: #f8fafc;         /* Very light gray (bot message bg) */
  --color-slate-700: #374151;        /* Dark gray (bot message text) */
  --color-slate-800: #1f2937;        /* Darker gray (button text) */
}
*/

// STEP 4: Test the fix
// Open browser DevTools (F12)
// 1. Right-click on bot message → Inspect
// 2. Check the "color" property under Computed Styles
// 3. Should show rgb(55, 65, 81) or similar dark color
// 4. Check background-color should be rgb(248, 250, 252)

// STEP 5: If still not working, add debug logging
// In addMessage function, add:
/*
console.log(`[MSG] Added ${sender} message:`, {
  text: text.substring(0, 50),
  sender,
  className: sender === "user" ? "user-msg-class" : "bot-msg-class"
});
*/

// STEP 6: Clear cache and rebuild
// npm run build
// Clear browser cache (Ctrl+Shift+Delete)
// Hard refresh (Ctrl+Shift+R)

// WHAT TO CHECK IF STILL WHITE:
// 1. Is primary color in Tailwind config actually white? 
//    Search for: --color-primary: #ffffff
// 2. Is there a CSS override applying white text?
//    Search for: color: white !important
// 3. Is the message container overflow:hidden?
//    Could be cutting off text or affecting rendering
// 4. Is z-index issue? Check parent container
// 5. Try removing all Tailwind classes and use inline styles only
