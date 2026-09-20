# Usable Text Drawings

FoundryVTT module that makes text drawings work like text does everywhere else: pick the text tool, click where you want it, type.

**Tested and works** on Foundry **v13 and v14**. System-agnostic.

## What it does

- **Click to type.** With the text tool, a click on the scene opens a text box right there, with a caret, selection, copy and paste, undo and IME input. The box of such a text hugs it, and keeps hugging it as the text, font or size changes, so there is nothing to resize and nothing for the text to wrap in.
- **Or drag a box**, as before. Text typed into it wraps at its edges, and is aligned within it.
- **Multiline.** `Shift+Enter` breaks the line. `Enter`, `Escape` or a click elsewhere finishes the text, and a click elsewhere with the text tool also starts the next one.
- **No border, no fill**, unless you switch them on. Text has to be typed before anything is created, so an invisible box is not a problem.
- **Left and top aligned**, unless you pick otherwise, horizontally and vertically. For a text placed with a click, the alignment is also what stays on the clicked spot as the text grows: its left edge, its centre or its right edge. This holds for rotated text too.
- **A formatting bar** at the top of the screen while the text tool or a text box is in use: font, size, colour, bold, italic, both alignments, whether the box is fitted to the text, a background with its colour, a border, and a button for the full drawing configuration at the end. What you pick applies to the text being edited and sticks for the next one.
- **Editing.** Click a text with the text tool, or double-click it with the select tool, to edit it in place. The configuration dialog is still there, behind the button on the formatting bar and on double-clicks of drawings without text. Its text field takes several lines too, instead of joining them into one.

## Existing drawings

Text drawings made without the module keep looking exactly as they did, wrapped and centred in their box, and are edited in place in that layout. Any of them can be restyled from the formatting bar like a text made with the module, which is when it starts being laid out by it.

What the module stores is a handful of flags under `flags.usable-text-drawings`: the two alignments, whether the box is fitted, bold and italic. Everything else is a regular text drawing. Without the module, core centres the text in its box, which leaves a fitted text where it was and moves one in a larger box to the middle of it.
