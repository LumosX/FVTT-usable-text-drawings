# Usable Text Drawings

FoundryVTT module that makes text drawings work like text does everywhere else: pick the text tool, click where you want it, type.

**Tested and works** on Foundry **v13 and v14**. System-agnostic.

## What it does

- **Click to type.** With the text tool, a click on the scene opens a text box right there, with a caret, selection, copy and paste, undo and IME input. No box to drag out first.
- **Multiline.** `Shift+Enter` breaks the line. `Enter`, `Escape` or a click elsewhere finishes the text, and a click elsewhere with the text tool also starts the next one.
- **No box.** New text has no border and no fill. Its box hugs the text and keeps hugging it as the text, font or size changes, so there is nothing to resize and nothing for the text to wrap or spill out of.
- **Left and top aligned.** Text grows to the right of and down from where you clicked. It can also be centred on, or right-aligned to, that spot. This holds for rotated text too.
- **A formatting bar** at the top of the screen while the text tool or a text box is in use: font, size, colour and alignment, plus a button for the full drawing configuration at the end. What you pick applies to the text being edited and sticks for the next one.
- **Editing.** Click a text with the text tool, or double-click it with the select tool, to edit it in place. The configuration dialog is still there, behind the button on the formatting bar and on double-clicks of drawings without text.

## Existing drawings

Text drawings made without the module keep looking exactly as they did, wrapped and centred in their box, and are edited in place in that layout. Picking an alignment for one on the formatting bar is what turns it into a text of the kind described above. Its lines stay broken where they were.

The module only adds one flag to the drawings it manages, `flags.usable-text-drawings.align`. Everything else is a regular text drawing. Without the module, core centres the text in a box that fits it exactly, so it stays where it was.
