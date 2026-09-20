export const MODULE_ID = "usable-text-drawings";

const STYLE_SETTING = "textStyle";
const DEFAULT_STYLE = { fontFamily: "", fontSize: 48, textColor: "#ffffff", bold: false, italic: false, align: "left", valign: "top", fill: false, fillColor: "#000000", fillAlpha: 0.5, border: false };

// The layout of the text of a drawing is kept in the flags of this module. A drawing without them is laid out by core, which amounts to this.
const CORE_LAYOUT = { align: "center", valign: "middle", fit: false, bold: false, italic: false };
const LAYOUT_KEYS = Object.keys(CORE_LAYOUT);

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
    return game.settings.set(MODULE_ID, STYLE_SETTING, style);
}

export function isManaged(drawingData) {
    return drawingData.flags?.[MODULE_ID] !== undefined;
}

export function getLayout(drawingData) {
    return { ...CORE_LAYOUT, ...drawingData.flags?.[MODULE_ID] };
}

export function getAnchor(drawingData) {
    const { align, valign } = getLayout(drawingData);
    return { x: ANCHORS[align], y: ANCHORS[valign] };
}

export function getStyle(drawingData) {
    const { fontFamily, fontSize, textColor, fillColor, fillType, strokeWidth } = drawingData;
    const fill = fillType !== CONST.DRAWING_FILL_TYPES.NONE;

    return { fontFamily, fontSize, textColor, fillColor, fill, border: strokeWidth > 0, ...getLayout(drawingData) };
}

export function applyStyle(drawingData, { fill, border, ...style }) {
    for (const [key, value] of Object.entries(style)) {
        const path = LAYOUT_KEYS.includes(key) ? `flags.${MODULE_ID}.${key}` : key;
        foundry.utils.setProperty(drawingData, path, value);
    }

    if (fill !== undefined)
        drawingData.fillType = fill ? CONST.DRAWING_FILL_TYPES.SOLID : CONST.DRAWING_FILL_TYPES.NONE;

    if (border !== undefined)
        drawingData.strokeWidth = border ? drawingData.strokeWidth || CONFIG.Drawing.documentClass.schema.fields.strokeWidth.initial : 0;

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
    const affectsFit = REFIT_TRIGGERS.some(key => foundry.utils.hasProperty(changes, key));

    if (!affectsFit || "shape" in changes)
        return;

    const updated = foundry.utils.mergeObject(document.toObject(), changes, { inplace: false });

    if (getLayout(updated).fit)
        foundry.utils.mergeObject(changes, fitToText(updated, getTextInset(document)));
}
