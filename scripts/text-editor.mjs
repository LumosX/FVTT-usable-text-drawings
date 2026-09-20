import { CORE_STYLE_KEYS, MODULE_ID, applyStyle, fitToText, getAnchor, getLayout, getStyle, getTextArea, getTextInset, hasVisibleBox, measureText, wrapsText } from "./text-style.mjs";

export const EDITING_CHANGED_HOOK = `${MODULE_ID}.editingChanged`;

const SAVED_FIELDS = ["text", "x", "y", "shape", "flags", ...CORE_STYLE_KEYS];

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
    #fill = document.createElement("div");
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

        this.#fill.className = "fill";

        const box = this.#box;
        box.className = "usable-text-drawings-editor";
        box.append(this.#fill, textarea);
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
            // A fitted box has no width to wrap to, so text which was wrapping keeps its lines by having them broken for real.
            if (style.fit && !getLayout(draft).fit && wrapsText(draft))
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
        const { align } = getLayout(draft);
        const metrics = measureText(draft);
        const { style } = metrics;
        const wraps = wrapsText(draft);
        const anchor = getAnchor(draft);
        const inset = getTextInset(draft);
        const area = getTextArea(draft);
        const text = { width: Math.ceil(metrics.width), height: Math.ceil(metrics.height) };
        const textarea = this.#textarea;

        // Room for the stroke of the outermost glyphs, which the text itself is not offset by.
        const overhang = style.strokeThickness;

        if (textarea.value !== draft.text)
            textarea.value = draft.text;

        Object.assign(this.#box.style, {
            left: `${draft.x}px`,
            top: `${draft.y}px`,
            width: `${draft.shape.width}px`,
            height: `${draft.shape.height}px`,
            rotate: `${draft.rotation}deg`,
            boxShadow: this.#isRectangle ? `inset 0 0 0 ${draft.strokeWidth}px ${foundry.utils.Color.from(draft.strokeColor).toRGBA(draft.strokeAlpha)}` : "none"
        });

        Object.assign(textarea.style, {
            // Text which does not wrap is laid out as wide as it is, so that it spills out of the box just as it does on the canvas.
            left: `${inset + (wraps ? 0 : anchor.x * (area.width - text.width)) - overhang / 2}px`,
            top: `${inset + anchor.y * (area.height - text.height)}px`,
            width: `${(wraps ? area.width : text.width) + overhang}px`,
            height: `${text.height}px`,
            fontFamily: `"${style.fontFamily}"`,
            fontSize: `${style.fontSize}px`,
            fontWeight: style.fontWeight,
            fontStyle: style.fontStyle,
            lineHeight: `${metrics.lineHeight}px`,
            paddingInline: `${overhang / 2}px`,
            color: draft.textColor,
            opacity: draft.textAlpha,
            textAlign: align,
            whiteSpace: wraps ? "pre-wrap" : "pre",
            webkitTextStroke: `${style.strokeThickness}px ${foundry.utils.Color.from(style.stroke).css}`,
            textShadow: `0 0 ${style.dropShadowBlur}px ${style.dropShadowColor}`
        });

        this.#renderFill();
    }

    // The fill sits in a layer of its own so that its opacity is its own, and a pattern can be tinted the way the canvas tints it.
    #renderFill() {
        const { fillType, fillColor, fillAlpha, texture } = this.#draft;
        const types = CONST.DRAWING_FILL_TYPES;
        const fill = this.#fill;

        fill.hidden = !this.#isRectangle || fillType === types.NONE;

        if (fill.hidden)
            return;

        // A pattern is shown untinted, transparent parts and all. The canvas tints it by the fill colour once the text is committed.
        const isPattern = fillType === types.PATTERN && !!texture;

        Object.assign(fill.style, {
            opacity: fillAlpha,
            backgroundColor: isPattern ? "transparent" : foundry.utils.Color.from(fillColor).css,
            backgroundImage: isPattern ? `url("${foundry.utils.getRoute(texture)}")` : "none"
        });
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
