import { applyStyle, getDefaultStyle } from "./text-style.mjs";
import TextEditor, { onceClickEnds } from "./text-editor.mjs";

export default function UsableTextDrawingsLayerMixin(DrawingsLayer) {
    return class UsableTextDrawingsLayer extends DrawingsLayer {
        // The text tool places text where it is clicked rather than dragging out a box for it.
        _canDragLeftStart(user, event) {
            return game.activeTool !== "text" && super._canDragLeftStart(user, event);
        }

        _onClickLeft(event) {
            super._onClickLeft(event);

            if (game.activeTool !== "text" || !super._canDragLeftStart(game.user, event))
                return;

            const { x, y } = event.interactionData.origin;
            onceClickEnds(() => TextEditor.create(this.#getNewTextData({ x, y })));
        }

        #getNewTextData(origin) {
            const drawingData = this._getNewDrawingData(origin);
            const textOnly = { text: "", strokeWidth: 0, fillType: CONST.DRAWING_FILL_TYPES.NONE, shape: { type: "r", width: 0, height: 0 } };

            return applyStyle(Object.assign(drawingData, textOnly), getDefaultStyle());
        }
    };
}
