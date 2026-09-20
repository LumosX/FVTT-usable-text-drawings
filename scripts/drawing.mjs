import { ANCHOR_X, getAlign, getTextInset } from "./text-style.mjs";
import TextEditor, { onceClickEnds } from "./text-editor.mjs";

export default function UsableTextDrawingMixin(Drawing) {
    return class UsableTextDrawing extends Drawing {
        _getTextStyle() {
            const style = super._getTextStyle();
            const align = getAlign(this.document);

            if (align)
                Object.assign(style, { align, wordWrap: false });

            return style;
        }

        _refreshPosition() {
            super._refreshPosition();
            const align = getAlign(this.document);

            if (!this.text || !align)
                return;

            const inset = getTextInset(this.document);
            this.text.anchor.set(ANCHOR_X[align], 0);
            this.text.position.set(inset + ANCHOR_X[align] * (this.document.shape.width - 2 * inset), inset);
        }

        _onUpdate(changed, options, userId) {
            super._onUpdate(changed, options, userId);

            if (getAlign(changed))
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
