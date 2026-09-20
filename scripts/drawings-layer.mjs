import { applyStyle, getDefaultStyle, getTextInset } from "./text-style.mjs";
import TextEditor, { onceClickEnds } from "./text-editor.mjs";

// With the text tool, a click places text in a box that is kept fitted to it, and a drag draws a box of fixed size for text to wrap in.
// Either way the text is typed first and the drawing created after, so that it needs no border or fill to be valid while still empty.
export default function UsableTextDrawingsLayerMixin(DrawingsLayer) {
    return class UsableTextDrawingsLayer extends DrawingsLayer {
        #pressedPoint = null;
        #isDragging = false;

        _onClickLeft(event) {
            super._onClickLeft(event);

            if (game.activeTool !== "text" || !this._canDragLeftStart(game.user, event))
                return;

            const { x, y } = event.interactionData.origin;
            this.#pressedPoint = { x, y };
            this.#isDragging = false;
            onceClickEnds(() => this.#onClickEnd());
        }

        _onDragLeftStart(event) {
            this.#isDragging = true;
            super._onDragLeftStart(event);
        }

        _onDragLeftDrop(event) {
            if (game.activeTool !== "text")
                return super._onDragLeftDrop(event);

            const preview = event.interactionData.preview;

            if (!preview)
                return;

            const { x, y, shape: { width, height } } = preview.document;
            const drawingData = this.#getNewTextData({ fit: false });
            const { fontSize } = drawingData;

            // A box with no room for a couple of characters was hardly drawn on purpose, more likely by a click that slipped.
            if (width < 2 * fontSize || height < fontSize)
                return this.#createFittedText(this.#pressedPoint);

            TextEditor.create(foundry.utils.mergeObject(drawingData, { x, y, shape: { width, height } }));
        }

        #onClickEnd() {
            if (!this.#isDragging)
                this.#createFittedText(this.#pressedPoint);
        }

        // The box starts out empty around the pressed point, which the anchor of the text then stays on.
        #createFittedText({ x, y }) {
            const drawingData = this.#getNewTextData({ fit: true });
            const inset = getTextInset(drawingData);
            const size = 2 * inset;

            TextEditor.create(foundry.utils.mergeObject(drawingData, { x: x - inset, y: y - inset, shape: { width: size, height: size } }));
        }

        #getNewTextData({ fit }) {
            const drawingData = this._getNewDrawingData({ x: 0, y: 0 });
            drawingData.text = "";

            return applyStyle(drawingData, { ...getDefaultStyle(), fit });
        }
    };
}
