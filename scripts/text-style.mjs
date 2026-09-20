export const MODULE_ID = "usable-text-drawings";

const STYLE_SETTING = "textStyle";

// The layout of the text of a drawing is kept in the flags of this module. A drawing without them is laid out by core, which amounts to this.
const CORE_LAYOUT = { align: "center", valign: "middle", fit: false, wrap: true, bold: false, italic: false };
const LAYOUT_KEYS = Object.keys(CORE_LAYOUT);

// The fields of the drawing itself which the formatting bar sets.
export const CORE_STYLE_KEYS = ["fontFamily", "fontSize", "textColor", "fillType", "fillColor", "fillAlpha", "texture", "strokeWidth", "strokeColor", "strokeAlpha"];

export const FONT_SIZE_RANGE = { min: 8, max: 256 };

// Everything the bar remembers for the next text. Whether its box is fitted is not among it: that is down to how the text is placed.
const DEFAULT_STYLE = {
    fontFamily: "", fontSize: 48, textColor: "#ffffff", bold: false, italic: false, align: "left", valign: "top", wrap: true,
    fillType: CONST.DRAWING_FILL_TYPES.NONE, fillColor: "#000000", fillAlpha: 0.5, texture: null,
    strokeWidth: 0, strokeColor: "#ffffff", strokeAlpha: 1
};

// How far along its free space the text sits. This is also the point of the text which stays put as a fitted box resizes around it.
const ANCHORS = { left: 0, center: 0.5, right: 1, top: 0, middle: 0.5, bottom: 1 };

const REFIT_TRIGGERS = ["text", "fontFamily", "fontSize", "strokeWidth", "strokeAlpha", "fillType", "fillAlpha", `flags.${MODULE_ID}`];

export function registerStyleSetting() {
    game.settings.register(MODULE_ID, STYLE_SETTING, { scope: "client", config: false, type: Object, default: DEFAULT_STYLE });
}

export function getDefaultStyle() {
    return { ...DEFAULT_STYLE, ...game.settings.get(MODULE_ID, STYLE_SETTING) };
}

export function setDefaultStyle(style) {
    const stored = {};

    for (const key of Object.keys(DEFAULT_STYLE))
        if (key in style) stored[key] = style[key];

    return game.settings.set(MODULE_ID, STYLE_SETTING, stored);
}

// A form hands back strings for what the schema wants as numbers, and an empty path for no texture.
export function cleanStyle(style) {
    const cleaned = { ...style };
    const clampNumber = (key, min, max) => {
        if (key in cleaned) cleaned[key] = Math.clamp(Number(cleaned[key]) || 0, min, max);
    };

    clampNumber("fontSize", FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max);
    clampNumber("fillType", 0, Math.max(...Object.values(CONST.DRAWING_FILL_TYPES)));
    clampNumber("fillAlpha", 0, 1);
    clampNumber("strokeAlpha", 0, 1);
    clampNumber("strokeWidth", 0, Number.MAX_SAFE_INTEGER);

    if ("fontSize" in cleaned) cleaned.fontSize = Math.round(cleaned.fontSize);
    if ("strokeWidth" in cleaned) cleaned.strokeWidth = Math.round(cleaned.strokeWidth);
    if ("texture" in cleaned) cleaned.texture = cleaned.texture || null;

    return cleaned;
}

export function isManaged(drawingData) {
    return drawingData.flags?.[MODULE_ID] !== undefined;
}

export function getLayout(drawingData) {
    return { ...CORE_LAYOUT, ...drawingData.flags?.[MODULE_ID] };
}

// A fitted box is exactly as wide as its text, so wrapping within one could never do anything.
export function wrapsText(drawingData) {
    const { wrap, fit } = getLayout(drawingData);
    return wrap && !fit;
}

export function getAnchor(drawingData) {
    const { align, valign } = getLayout(drawingData);
    return { x: ANCHORS[align], y: ANCHORS[valign] };
}

export function getStyle(drawingData) {
    const style = getLayout(drawingData);

    for (const key of CORE_STYLE_KEYS) style[key] = drawingData[key];

    return style;
}

export function applyStyle(drawingData, style) {
    for (const [key, value] of Object.entries(style)) {
        if (LAYOUT_KEYS.includes(key)) foundry.utils.setProperty(drawingData, `flags.${MODULE_ID}.${key}`, value);
        else if (CORE_STYLE_KEYS.includes(key)) drawingData[key] = value;
    }

    return drawingData;
}

export function hasVisibleBox({ fillType, fillAlpha, strokeWidth, strokeAlpha }) {
    const hasFill = fillType !== CONST.DRAWING_FILL_TYPES.NONE && fillAlpha > 0;
    const hasBorder = strokeWidth > 0 && strokeAlpha > 0;

    return hasFill || hasBorder;
}

// Core draws the border inside the box and lays its text out right over it. Managed text keeps clear of the border, and of the edges of a box that shows.
export function getTextInset(drawingData) {
    if (!isManaged(drawingData))
        return 0;

    const padding = hasVisibleBox(drawingData) ? Math.round(drawingData.fontSize / 4) : 0;
    return drawingData.strokeWidth + padding;
}

export function getTextArea(drawingData) {
    const insets = 2 * getTextInset(drawingData);
    const { width, height } = drawingData.shape;

    return { width: Math.max(width - insets, 0), height: Math.max(height - insets, 0) };
}

export function measureText(drawingData) {
    // Core derives the text style from the document alone, so source data can stand in for a Drawing placed on the canvas.
    const style = CONFIG.Drawing.objectClass.prototype._getTextStyle.call({ document: drawingData });
    return PIXI.TextMetrics.measureText(drawingData.text || " ", style);
}

// The position and size which make the box hug the text, without the text moving on the canvas.
// The inset is the one the current box was laid out with, which a change of border, fill or font size makes differ from the new one.
export function fitToText(drawingData, previousInset) {
    const { x, y, shape: box, rotation = 0 } = drawingData;
    const anchor = getAnchor(drawingData);
    const metrics = measureText(drawingData);
    const text = { width: Math.ceil(metrics.width), height: Math.ceil(metrics.height) };
    const insets = 2 * getTextInset(drawingData);
    const fitted = { width: text.width + insets, height: text.height + insets };

    // Core rotates a drawing around the centre of its box, so the anchor only stays put if that centre moves along the rotated axes.
    const dx = (anchor.x - 0.5) * (box.width - 2 * previousInset - text.width);
    const dy = (anchor.y - 0.5) * (box.height - 2 * previousInset - text.height);
    const angle = Math.toRadians(rotation);
    const centreX = x + box.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle);
    const centreY = y + box.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle);

    return { x: centreX - fitted.width / 2, y: centreY - fitted.height / 2, shape: fitted };
}

// Keeps a fitted box fitted whoever changes the drawing: the text editor, the config sheet or a macro.
export function refitOnUpdate(document, changes) {
    // The changes may not be narrowed down to actual differences yet. The config sheet submits its every field, the size of the box among them.
    const source = document.toObject();
    const differences = foundry.utils.diffObject(source, changes);
    const affectsFit = REFIT_TRIGGERS.some(key => foundry.utils.hasProperty(differences, key));

    // A box given another size on purpose, by its handles or in its config sheet, keeps it until its text next changes.
    if (!affectsFit || "shape" in differences)
        return;

    const updated = foundry.utils.mergeObject(source, changes);

    if (getLayout(updated).fit)
        foundry.utils.mergeObject(changes, fitToText(updated, getTextInset(document)));
}
