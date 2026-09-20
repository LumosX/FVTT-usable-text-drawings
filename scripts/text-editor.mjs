import { MODULE_ID, applyStyle, fitToText, getAlign, getStyle, getTextInset, measureText } from "./text-style.mjs";

export const EDITING_CHANGED_HOOK = `${MODULE_ID}.editingChanged`;

// A text box opened while the mouse button is still going down loses its focus to the default action of that click.
export function onceClickEnds(callback) {
    window.addEventListener("pointerup", callback, { once: true });
}

// A text box laid over the canvas, for composing a new text drawing or editing the text of an existing one.
export default class TextEditor {
    static active = null;
    static #saving = Promise.resolve();

    #draft;
    #drawing;
    #wasManaged;
    #scene = canvas.scene;
    #textarea = document.createElement("textarea");

    static async create(drawingData) {
        await TextEditor.#finishActive();
        new TextEditor(drawingData);
    }

    static async edit(drawing) {
        if (TextEditor.active?.#drawing === drawing)
            return;

        await TextEditor.#finishActive();

        if (!drawing.destroyed)
            new TextEditor(drawing.document.toObject(), drawing);
    }

    static #finishActive() {
        TextEditor.active?.commit();
        return TextEditor.#saving;
    }

    constructor(drawingData, drawing = null) {
        this.#draft = drawingData;
        this.#drawing = drawing;
        this.#wasManaged = getAlign(drawingData) !== undefined;

        const textarea = this.#textarea;
        textarea.className = "usable-text-drawings-editor";
        textarea.spellcheck = false;
        textarea.value = drawingData.text;
        textarea.addEventListener("input", () => this.#onInput());
        textarea.addEventListener("keydown", event => this.#onKeyDown(event));

        // The HUD container follows the pan and zoom of the canvas, so the text box is laid out in canvas coordinates.
        document.getElementById("hud").append(textarea);
        window.addEventListener("pointerdown", this.#onPointerDown, { capture: true });

        // As in core, editing the text of a drawing does not leave it selected.
        drawing?.release();
        this.#showDrawing(false);

        this.#layout();
        textarea.focus();
        TextEditor.active = this;
        Hooks.callAll(EDITING_CHANGED_HOOK);
    }

    get style() {
        return getStyle(this.#draft);
    }

    restyle(style) {
        // Aligning a drawing laid out by core makes it a managed one, whose text never wraps, so its wrapped lines become real ones.
        if (style.align && !getAlign(this.#draft)) {
            this.#draft.text = measureText(this.#draft).lines.join("\n");
            this.#textarea.value = this.#draft.text;
        }

        applyStyle(this.#draft, style);
        this.#layout();
        this.#textarea.focus();
    }

    commit() {
        if (TextEditor.active !== this)
            return TextEditor.#saving;

        TextEditor.active = null;
        window.removeEventListener("pointerdown", this.#onPointerDown, { capture: true });
        Hooks.callAll(EDITING_CHANGED_HOOK);

        // Foundry reports a failed save itself. Left rejected, it would also keep every later text box from opening.
        TextEditor.#saving = this.#save().catch(error => console.error(error)).finally(() => this.#close());
        return TextEditor.#saving;
    }

    async configure() {
        const document = await this.commit();
        document?.sheet.render({ force: true });
    }

    async #save() {
        const draft = { ...this.#draft, text: this.#draft.text.trim() };

        if (!this.#drawing) {
            if (!draft.text)
                return;

            const [created] = await this.#scene.createEmbeddedDocuments("Drawing", [{ ...draft, ...fitToText(draft) }]);
            return created;
        }

        const document = this.#drawing.document;

        if (!draft.text && !hasVisibleBox(draft)) {
            await document.delete();
            return;
        }

        const { text, fontFamily, fontSize, textColor, flags } = draft;
        await document.update({ text, fontFamily, fontSize, textColor, flags });
        return document;
    }

    #close() {
        this.#textarea.remove();
        this.#showDrawing(true);
    }

    // The text box stands in for the text of the drawing and for its frame, which would not keep up with the text as it changes.
    // The box of the drawing itself is rendered elsewhere on the canvas and stays as it is.
    #showDrawing(isShown) {
        const drawing = this.#drawing;

        if (!drawing || drawing.destroyed)
            return;

        drawing.renderable = isShown;

        if (drawing.text)
            drawing.text.visible = isShown;
    }

    #layout() {
        const draft = this.#draft;
        const align = getAlign(draft);
        const metrics = measureText(draft);
        const { style } = metrics;
        const box = align ? fitToText(draft, this.#wasManaged) : this.#getCoreLayoutBox(metrics);
        const inset = align ? getTextInset(draft) : 0;

        Object.assign(this.#textarea.style, {
            left: `${box.x + inset}px`,
            top: `${box.y + inset}px`,
            width: `${box.shape.width - 2 * inset}px`,
            height: `${box.shape.height - 2 * inset}px`,
            rotate: `${draft.rotation}deg`,
            fontFamily: `"${style.fontFamily}"`,
            fontSize: `${style.fontSize}px`,
            lineHeight: `${metrics.lineHeight}px`,
            paddingInline: `${style.strokeThickness / 2}px`,
            color: draft.textColor,
            opacity: draft.textAlpha,
            textAlign: align ?? "center",
            whiteSpace: align ? "pre" : "pre-wrap",
            webkitTextStroke: `${style.strokeThickness}px ${foundry.utils.Color.from(style.stroke).css}`,
            textShadow: `0 0 ${style.dropShadowBlur}px ${style.dropShadowColor}`
        });
    }

    // Core wraps the text to the width of its box and centres it within.
    #getCoreLayoutBox(metrics) {
        const { x, y, shape } = this.#draft;
        const height = Math.ceil(metrics.height);

        return { x, y: y + (shape.height - height) / 2, shape: { width: shape.width, height } };
    }

    #onInput() {
        this.#draft.text = this.#textarea.value;
        this.#layout();
    }

    #onKeyDown(event) {
        // Once the text box is gone, Foundry would take the key that finished it for a keybinding of its own.
        event.stopPropagation();

        const isFinished = event.key === "Escape" || (event.key === "Enter" && !event.shiftKey && !event.isComposing);

        if (!isFinished)
            return;

        event.preventDefault();
        this.commit();
    }

    #onPointerDown = event => {
        if (event.button === 0 && event.target === canvas.app.view)
            this.commit();
    };
}

function hasVisibleBox({ fillType, fillAlpha, strokeWidth, strokeAlpha }) {
    const hasFill = fillType !== CONST.DRAWING_FILL_TYPES.NONE && fillAlpha > 0;
    const hasLine = strokeWidth > 0 && strokeAlpha > 0;

    return hasFill || hasLine;
}
