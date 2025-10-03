# 🎨 AI Fast Mode UI Preview

## Visual Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Traitement IA avec explications détaillées                             │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  🧠                                                                 │ │
│  │                                                                     │ │
│  │  Glissez-déposez votre fichier ici                                 │ │
│  │  ou cliquez pour sélectionner • Excel (.xlsx, .xls) ou CSV         │ │
│  │  Traitement IA avec explications détaillées                        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Instructions personnalisées (optionnel)                                │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Ajoutez des instructions spécifiques pour l'IA (ex: focus sur la  │ │
│  │ cardiologie, style académique, etc.)                               │ │
│  │                                                                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ╔════════════════════════════════════════════════════════════════════╗ │
│  ║  Mode Rapide IA                    ┌─────────────┐    ┌──────────┐ ║ │
│  ║                                     │ ⚡ Activé   │    │  🔵──○   │ ║ │
│  ║                                     └─────────────┘    └──────────┘ ║ │
│  ║                                                                     ║ │
│  ║  Traitement ultra-rapide (2-3 secondes pour 100 questions).        ║ │
│  ║  L'IA génère des explications détaillées sans passe                ║ │
│  ║  d'amélioration supplémentaire. Qualité: 85-90%                    ║ │
│  ╚════════════════════════════════════════════════════════════════════╝ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │              🧠  Créer un job IA                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## When Toggle is OFF (Quality Mode)

```
  ╔════════════════════════════════════════════════════════════════════╗
  ║  Mode Rapide IA                    ┌────────────────┐  ┌──────────┐ ║
  ║                                     │ 🔄 Qualité Max │  │  ○──⚪   │ ║
  ║                                     └────────────────┘  └──────────┘ ║
  ║                                                                     ║
  ║  Traitement avec amélioration (12-33 secondes pour 100 questions). ║
  ║  Les explications courtes sont ré-analysées pour plus de détails.  ║
  ║  Qualité: 95-100%                                                   ║
  ╚════════════════════════════════════════════════════════════════════╝
```

## Color Scheme

### Fast Mode (Default - ON)
- **Box Background**: Gradient from `blue-50` to `indigo-50` (light blue)
- **Border**: `blue-800` (dark blue)
- **Label Text**: `blue-900` (very dark blue) / `blue-100` (light in dark mode)
- **Description**: `blue-700` / `blue-300` (readable blue)
- **Badge**: White background with 50% opacity
- **Toggle**: `bg-blue-600` (solid blue)
- **Toggle Knob**: White circle, positioned right

### Quality Mode (OFF)
- **Box Background**: Same gradient (blue to indigo)
- **Border**: Same `blue-800`
- **Label Text**: Same blue tones
- **Description**: Same blue tones
- **Badge**: White background with 50% opacity
- **Toggle**: `bg-gray-300` / `bg-gray-600` (gray)
- **Toggle Knob**: White circle, positioned left

## Responsive Behavior

### Desktop (Wide Screen)
```
┌────────────────────────────────────────────────────────────┐
│  Mode Rapide IA                    [Badge]         [Toggle] │
│                                                              │
│  Full description text in one line or wrapped nicely        │
└────────────────────────────────────────────────────────────┘
```

### Mobile (Narrow Screen)
```
┌─────────────────────────────┐
│  Mode Rapide IA      [Badge]│
│                     [Toggle] │
│                              │
│  Description wraps to        │
│  multiple lines for better   │
│  readability on mobile       │
└─────────────────────────────┘
```

## Interactive States

### Hover State
- Toggle button shows focus ring: `focus:ring-2 focus:ring-blue-500`
- Cursor changes to pointer
- Slight scale animation possible

### Click Animation
```
Before Click (Fast Mode ON):
  Toggle: 🔵──────○  (blue background, knob on right)

Clicking...
  Toggle: 🔵───○───  (transitioning)

After Click (Quality Mode OFF):
  Toggle: ○──────⚪  (gray background, knob on left)
```

### Transition Duration
- `transition-colors`: Smooth color change
- `transition-transform`: Knob slides smoothly

## Badge Variations

### Fast Mode Badge
```
┌────────────┐
│ ⚡ Activé  │  (lightning bolt + text)
└────────────┘
Background: white with 50% opacity
Border: outline variant
Text: matches current mode color
```

### Quality Mode Badge
```
┌──────────────────┐
│ 🔄 Qualité Max   │  (circular arrows + text)
└──────────────────┘
Background: white with 50% opacity
Border: outline variant
Text: matches current mode color
```

## Real Component Structure

```tsx
<div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-indigo-50 
                dark:from-blue-950/20 dark:to-indigo-950/20 dark:border-blue-800">
  <div className="flex items-start justify-between gap-4">
    
    {/* Left side: Label + Description */}
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <label className="text-sm font-semibold text-blue-900 dark:text-blue-100">
          Mode Rapide IA
        </label>
        <Badge variant="outline" className="text-xs bg-white/50 dark:bg-black/20">
          {fastMode ? '⚡ Activé' : '🔄 Qualité Max'}
        </Badge>
      </div>
      <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
        {fastMode ? (
          <>
            <strong>Traitement ultra-rapide</strong> (2-3 secondes pour 100 questions). 
            L'IA génère des explications détaillées sans passe d'amélioration supplémentaire. 
            Qualité: <strong>85-90%</strong>
          </>
        ) : (
          <>
            <strong>Traitement avec amélioration</strong> (12-33 secondes pour 100 questions). 
            Les explications courtes sont ré-analysées pour plus de détails. 
            Qualité: <strong>95-100%</strong>
          </>
        )}
      </p>
    </div>
    
    {/* Right side: Toggle Switch */}
    <button
      type="button"
      onClick={() => setFastMode(!fastMode)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full 
                  transition-colors focus:outline-none focus:ring-2 
                  focus:ring-blue-500 focus:ring-offset-2 ${
        fastMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
      role="switch"
      aria-checked={fastMode}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white 
                        transition-transform ${
        fastMode ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
    
  </div>
</div>
```

## Accessibility Features

- ✅ **Semantic HTML**: Uses `<button>` with `role="switch"`
- ✅ **ARIA attributes**: `aria-checked` reflects current state
- ✅ **Focus ring**: Visible focus indicator for keyboard navigation
- ✅ **Color contrast**: Text meets WCAG AA standards
- ✅ **Clear labels**: Mode purpose clearly described
- ✅ **Visual feedback**: Badge and toggle state changes are obvious

## Dark Mode Support

### Light Mode
- Background: Light blue gradient
- Text: Dark blue
- Toggle ON: Solid blue
- Toggle OFF: Light gray

### Dark Mode
- Background: Dark blue gradient (reduced opacity)
- Border: Dark blue
- Text: Light blue
- Toggle ON: Solid blue (same)
- Toggle OFF: Dark gray

---

**The UI is clean, intuitive, and provides clear visual feedback for both states!** ✨
