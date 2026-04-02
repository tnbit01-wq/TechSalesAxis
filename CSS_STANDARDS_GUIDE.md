# CSS Best Practices Reference Guide

## After CSS Fixes - Follow These Standards

### Form Elements (Select, Input)

#### ✅ CORRECT Pattern
```tsx
<select className="w-full bg-white border-2 border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer">
  <option value="">Select Option</option>
  <option value="value1">Option 1</option>
</select>

<input 
  type="text"
  className="w-full bg-white border-2 border-slate-300 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 placeholder:text-slate-400"
  placeholder="Enter text..."
/>
```

#### ❌ WRONG - Don't Use
```tsx
// Semi-transparent backgrounds
className="bg-slate-50/50"  // ❌

// Very subtle focus rings
className="focus:ring-primary/20"  // ❌

// No text color specified
className="border border-gray-300 rounded-lg"  // ❌

// Only using opacity for disabled state
className="disabled:opacity-50"  // ❌

// Styling option elements (won't work!)
<option className="text-primary">Don't do this</option>  // ❌
```

---

### Button States

#### ✅ CORRECT Disabled Button
```tsx
<button 
  disabled={isLoading}
  className="px-4 py-2 bg-primary text-white rounded-lg transition-all disabled:bg-slate-200 disabled:text-slate-700 disabled:cursor-not-allowed"
>
  Submit
</button>
```

#### ✅ CORRECT Hover State
```tsx
<button className="px-4 py-2 bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 rounded-lg">
  Action
</button>
```

#### ❌ WRONG - Don't Use
```tsx
// Don't hide text on disabled
className="disabled:opacity-50"  // ❌

// Don't make text invisible on hover
className="hover:text-white"  // when bg is already white ❌

// Don't use conflicting colors
className="text-white bg-white"  // ❌
```

---

### Focus States

#### ✅ Proper Focus Ring (Visible from 1 meter away)
```tsx
focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50
```

**Why this works:**
- `border-primary`: Shows focus border in brand color
- `ring-2`: 2px ring (not 1px - too thin)
- `ring-primary/50`: 50% opacity ring (not 20% - too subtle)

#### ❌ Insufficient Focus Ring
```tsx
focus:ring-2 focus:ring-primary/20  // Only 20% visible ❌
focus:ring-1  // Too thin ❌
focus:outline-none  // No ring at all ❌
```

---

### Color Standards

#### ✅ Text Colors
```
text-slate-900   // Default text (very dark)
text-slate-700   // Secondary text (dark)
text-slate-600   // Tertiary text (medium)
text-slate-500   // Helper text (light)
text-slate-400   // Placeholder text (very light)
```

#### ✅ Background Colors
```
bg-white         // Primary backgrounds
bg-slate-50      // Secondary backgrounds (with white border for contrast)
bg-slate-100     // Disabled or inactive states
bg-slate-200     // Hover states on neutral buttons
bg-primary       // CTA buttons
```

#### ✅ Border Colors
```
border-slate-300  // Primary borders (on white backgrounds)
border-slate-200  // Secondary borders (subtle)
border-primary    // Focus or selected state
border-2          // Use 2px for better visibility
```

---

### Disabled State Pattern

#### ✅ Complete Disabled Styling
```tsx
className="... disabled:bg-slate-200 disabled:text-slate-700 disabled:border-slate-300 disabled:cursor-not-allowed disabled:shadow-none"
```

**Why all 4 matters:**
1. `disabled:bg-slate-200` - Changes background (not just opacity)
2. `disabled:text-slate-700` - Ensures readable text
3. `disabled:border-slate-300` - Keeps border visible (not faded)
4. `disabled:cursor-not-allowed` - UX signal

#### ❌ Incomplete - Avoid
```tsx
className="disabled:opacity-50"  // ❌ Just fades everything
className="disabled:opacity-50 disabled:cursor-not-allowed"  // ❌ Still not enough
```

---

### Contrast Ratios

#### ✅ WCAG AA Compliant (minimum 4.5:1)
```
slate-900 on white:   ~17:1 ✅
slate-700 on white:   ~12:1 ✅
slate-600 on white:    ~8:1 ✅
slate-500 on white:    ~6:1 ✅
slate-400 on white:    ~4.5:1 ✅
slate-300 on white:    ~2.5:1 ❌
```

#### ✅ Disabled States Must Maintain Contrast
```
slate-200 bg + slate-700 text:  ~7:1 ✅
slate-200 bg + slate-600 text:  ~6:1 ✅
slate-200 bg + slate-500 text:  ~4.5:1 ✅

slate-800 bg + slate-600 text:  ~2:1 ❌ (FAILS)
white bg + slate-300 text:       ~2.5:1 ❌ (FAILS)
```

---

## Checklist Before Committing Changes

Before submitting any CSS changes, verify:

- [ ] **Text Color:** Specified explicitly (not relying on browser defaults)
- [ ] **Background:** Specified explicitly (not semi-transparent)
- [ ] **Focus Ring:** `focus:ring-2 focus:ring-primary/50` (not 20% opacity)
- [ ] **Disabled State:** Changes background + text color (not just opacity)
- [ ] **Hover State:** Text remains readable (contrasts with new background)
- [ ] **Contrast Ratio:** ≥4.5:1 for all text (verify with browser DevTools)
- [ ] **Option Elements:** No className added (they won't work anyway)
- [ ] **Cursor:** Includes `cursor-pointer` on clickables and `cursor-not-allowed` on disabled

---

## Testing Your Changes

### Quick Visual Test
1. Open page and look at all form fields
2. Tab through inputs - is focus visible?
3. Hover over buttons - can you read the text?
4. Check disabled buttons - do they look disabled?
5. Open DevTools and check contrast ratios (should be ≥4.5:1)

### Accessibility Test
```bash
# Using Chrome DevTools:
1. Right-click element → Inspect
2. Look for contrast ratio warning
3. Check "Computed" tab for all applicable CSS
```

### Browser Compatibility
Test in:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Mobile Safari (iOS)
- Chrome Mobile (Android)

---

## Common Mistakes to Avoid

| ❌ Mistake | ✅ Fix | Why |
|-----------|------|-----|
| `bg-slate-50/50` | `bg-white` | Semi-transparent causes contrast issues |
| `text-white bg-white` | `text-slate-900 bg-white` | Invisible text |
| `focus:ring-primary/20` | `focus:ring-primary/50` | Focus too subtle |
| `disabled:opacity-50` | `disabled:bg-slate-200 disabled:text-slate-700` | Disabled state not clear |
| `<option className="...">` | Remove className | Native elements don't support styling |
| `border border-gray-300` | `border-2 border-slate-300` | Too thin and light |
| No focus state | Add `focus:ring-2 focus:ring-primary/50` | Keyboard users can't find focus |
| Text color unspecified | Add `text-slate-900` | Browser defaults vary |

---

## Resources

### Contrast Checker
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Color contrast in DevTools: Right-click element → Inspect → check overlay

### Tailwind Classes
- Colors: https://tailwindcss.com/docs/customizing-colors
- Focus: https://tailwindcss.com/docs/focus
- Disabled: https://tailwindcss.com/docs/hover-focus-and-other-states#disabled

### WCAG Guidelines
- Text Contrast: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum
- Focus Visible: https://www.w3.org/WAI/WCAG21/Understanding/focus-visible

---

**Last Updated:** April 2, 2026
**All CSS Visibility Issues:** ✅ RESOLVED
