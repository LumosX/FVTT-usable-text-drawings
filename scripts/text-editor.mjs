import { MODULE_ID, applyStyle, fitToText, getAnchor, getLayout, getStyle, getTextArea, getTextInset, hasVisibleBox, measureText } from "./text-style.mjs";

export const EDITING_CHANGED_HOOK = `${MODULE_ID}.editingChanged`;

const SAVED_FIELDS = ["text", "fontFamily", "fontSize", "textColor", "fillType", "fillColor", "strokeWidth", "x", "y", "shape", "flags"];

// A text box opened while the mouse button is still going down loses its focus to the default action of that click.
export function onceClickEnds(callback) {
    window.addEventListener("pointerup", callback, { once: true });
}

// A text box laid over the canvas, for composing a new text drawing or editing the text of an existing one.
// It works on a draft of the drawing's data, which only becomes a drawing, or an update to one, once the text is finished.
export default class TextEditor {
    static active = null;
    static #saving = Promise.resolve();

    #draft;
    #drawing;
    #scene = canvas.scene;
    #box = document.createElement("div");
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

        const textarea = this.#textarea;
        textarea.spellcheck = false;
        textarea.addEventListener("input", () => this.#update(draft => draft.text = textarea.value));
        textarea.addEventListener("keydown", event => this.#onKeyDown(event));

        const box = this.#box;
        box.className = "usable-text-drawings-editor";
        box.append(textarea);
        box.addEventListener("pointerdown", event => this.#onPointerDownBox(event));

        // The HUD container follows the pan and zoom of the canvas, so the text box is laid out in canvas coordinates.
        document.getElementById("hud").append(box);
        window.addEventListener("pointerdown", this.#onPointerDownAnywhere, { capture: true });

        // As in core, editing the text of a drawing does not leave it selected.
        drawing?.release();
        this.#showDrawing(false);

        this.#update();
        textarea.focus();
        TextEditor.active = this;
        Hooks.callAll(EDITING_CHANGED_HOOK);
    }

    get style() {
        return getStyle(this.#draft);
    }

    // The points of any other shape would have to be scaled along with its box.
    get canFit() {
        return this.#isRectangle;
    }

    get #isRectangle() {
        return this.#draft.shape.type === foundry.data.ShapeData.TYPES.RECTANGLE;
    }

    restyle(style) {
        this.#update(draft => {
            // Fitted text never wraps, so text which did keeps its lines by having them broken for real.
            if (style.fit && !getLayout(draft).fit)
                draft.text = measureText(draft).lines.join("\n");

            applyStyle(draft, style);
        });

        this.#textarea.focus();
    }

    commit() {
        if (TextEditor.active !== this)
            return TextEditor.#saving;

        TextEditor.active = null;
        window.removeEventListener("pointerdown", this.#onPointerDownAnywhere, { capture: true });
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
        this.#update(draft => draft.text = draft.text.trim());
        const draft = this.#draft;

        if (!this.#drawing) {
            if (!draft.text)
                return;

            const [created] = await this.#scene.createEmbeddedDocuments("Drawing", [draft]);
            return created;
        }

        const document = this.#drawing.document;

        if (!draft.text && !hasVisibleBox(draft)) {
            await document.delete();
            return;
        }

        await document.update(Object.fromEntries(SAVED_FIELDS.map(field => [field, draft[field]])));
        return document;
    }

    #close() {
        this.#box.remove();
        this.#showDrawing(true);
    }

    // The editor stands in for the frame of the drawing, which would not keep up with its changes, and for what it draws of the drawing itself.
    // That is the text, along with the box if it is a rectangle. Any other shape is left to the canvas.
    #showDrawing(isShown) {
        const drawing = this.#drawing;

        if (!drawing || drawing.destroyed)
            return;

        const replaced = this.#isRectangle ? drawing.shape : drawing.text;
        drawing.renderable = isShown;

        if (replaced)
            replaced.renderable = isShown;
    }

    // Every change to the draft goes through here, so that a fitted box stays fitted.
    #update(change = () => {}) {
        const draft = this.#draft;
        const previousInset = getTextInset(draft);
        change(draft);

        if (getLayout(draft).fit)
            foundry.utils.mergeObject(draft, fitToText(draft, previousInset));

        this.#render();
    }

    #render() {
        const draft = this.#draft;
        const { align, fit } = getLayout(draft);
        const metrics = measureText(draft);
        const { style } = metrics;
        const inset = getTextInset(draft);
        const area = getTextArea(draft);
        const textHeight = Math.ceil(metrics.height);
        const textarea = this.#textarea;

        if (textarea.value !== draft.text)
            textarea.value = draft.text;

        Object.assign(this.#box.style, {
            left: `${draft.x}px`,
            top: `${draft.y}px`,
            width: `${draft.shape.width}px`,
            height: `${draft.shape.height}px`,
            rotate: `${draft.rotation}deg`,
            ...this.#getBoxAppearance()
        });

        Object.assign(textarea.style, {
            left: `${inset}px`,
            top: `${inset + getAnchor(draft).y * (area.height - textHeight)}px`,
            width: `${area.width}px`,
            height: `${textHeight}px`,
            fontFamily: `"${style.fontFamily}"`,
            fontSize: `${style.fontSize}px`,
            fontWeight: style.fontWeight,
            fontStyle: style.fontStyle,
            lineHeight: `${metrics.lineHeight}px`,
            paddingInline: `${style.strokeThickness / 2}px`,
            color: draft.textColor,
            opacity: draft.textAlpha,
            textAlign: align,
            whiteSpace: fit ? "pre" : "pre-wrap",
            webkitTextStroke: `${style.strokeThickness}px ${foundry.utils.Color.from(style.stroke).css}`,
            textShadow: `0 0 ${style.dropShadowBlur}px ${style.dropShadowColor}`
        });
    }

    // Like core, this draws the border inside the box.
    #getBoxAppearance() {
        const { fillType, fillColor, fillAlpha, strokeWidth, strokeColor, strokeAlpha } = this.#draft;
        const { Color } = foundry.utils;

        if (!this.#isRectangle)
            return { background: "none", boxShadow: "none" };

        const isFilled = fillType === CONST.DRAWING_FILL_TYPES.SOLID;

        return {
            background: isFilled ? Color.from(fillColor).toRGBA(fillAlpha) : "none",
            boxShadow: `inset 0 0 0 ${strokeWidth}px ${Color.from(strokeColor).toRGBA(strokeAlpha)}`
        };
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

    // A click in the box beside the text goes to the text, as it would in any text box.
    #onPointerDownBox(event) {
        if (event.target !== this.#box)
            return;

        event.preventDefault();
        this.#textarea.focus();
    }

    #onPointerDownAnywhere = event => {
        if (event.button === 0 && event.target === canvas.app.view)
            this.commit();
    };
}
