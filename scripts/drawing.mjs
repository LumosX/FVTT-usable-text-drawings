import { getAnchor, getLayout, getTextArea, getTextInset, isManaged, wrapsText } from "./text-style.mjs";
import TextEditor, { onceClickEnds } from "./text-editor.mjs";

export default function UsableTextDrawingMixin(Drawing) {
    return class UsableTextDrawing extends Drawing {
        _getTextStyle() {
            const style = super._getTextStyle();

            if (!isManaged(this.document))
                return style;

            const { align, bold, italic } = getLayout(this.document);

            return Object.assign(style, {
                align,
                wordWrap: wrapsText(this.document),
                wordWrapWidth: getTextArea(this.document).width,
                fontWeight: bold ? "bold" : "normal",
                fontStyle: italic ? "italic" : "normal"
            });
        }

        _refreshPosition() {
            super._refreshPosition();

            if (!this.text || !isManaged(this.document))
                return;

            const anchor = getAnchor(this.document);
            const inset = getTextInset(this.document);
            const area = getTextArea(this.document);
            this.text.anchor.set(anchor.x, anchor.y);
            this.text.position.set(inset + anchor.x * area.width, inset + anchor.y * area.height);
        }

        // The layout of managed text depends on its flags, and through its inset on the border, the fill and the font size.
        _onUpdate(changed, options, userId) {
            super._onUpdate(changed, options, userId);

            if (isManaged(this.document))
                this.renderFlags.set({ refreshText: true, refreshPosition: true });
        }

        // Core captures keystrokes here to build up the text one character at a time. The text editor replaces that.
        enableTextEditing(options = {}) {
            if (options.forceTextEditing)
                TextEditor.edit(this);
        }

        // Unlike a click, an unclick only happens if the drawing was not dragged.
        _onUnclickLeft(event) {
            super._onUnclickLeft(event);

            if (game.activeTool === "text" && this.controlled)
                TextEditor.edit(this);
        }

        _onClickLeft2(event) {
            if (!this.hasText)
                return super._onClickLeft2(event);

            onceClickEnds(() => TextEditor.edit(this));

            if (!this._propagateLeftClick(event))
                event.stopPropagation();
        }
    };
}
