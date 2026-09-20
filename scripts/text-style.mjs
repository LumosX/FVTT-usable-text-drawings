export const MODULE_ID = "usable-text-drawings";

// Where along its width a text box is pinned, so that it grows away from that edge as its text changes.
export const ANCHOR_X = { left: 0, center: 0.5, right: 1 };

const STYLE_SETTING = "textStyle";
const REFIT_TRIGGERS = ["text", "fontFamily", "fontSize", "strokeWidth", `flags.${MODULE_ID}.align`];

export function registerStyleSetting() {
    game.settings.register(MODULE_ID, STYLE_SETTING, {
        scope: "client",
        config: false,
        type: Object,
        default: { fontFamily: "", fontSize: 48, textColor: "#ffffff", align: "left" }
    });
}

export function getDefaultStyle() {
    return game.settings.get(MODULE_ID, STYLE_SETTING);
}

export function setDefaultStyle(style) {
    return game.settings.set(MODULE_ID, STYLE_SETTING, style);
}

// The alignment flag is what marks a drawing as managed by this module: its text is anchored to the top of a box which hugs it.
// Drawings without the flag keep core's layout of wrapped text centred in a box of fixed size.
export function getAlign(drawingData) {
    return drawingData.flags?.[MODULE_ID]?.align;
}

// Core draws the border of a drawing inside its box, so the text of a managed drawing is inset by as much to stay clear of it.
export function getTextInset(drawingData) {
    return drawingData.strokeWidth;
}

export function getStyle(drawingData) {
    const { fontFamily, fontSize, textColor } = drawingData;
    return { fontFamily, fontSize, textColor, align: getAlign(drawingData) };
}

export function applyStyle(drawingData, { align, ...coreFields }) {
    Object.assign(drawingData, coreFields);

    if (align)
        foundry.utils.setProperty(drawingData, `flags.${MODULE_ID}.align`, align);

    return drawingData;
}

export function measureText(drawingData) {
    // Core derives the text style from the document alone, so source data can stand in for a Drawing placed on the canvas.
    const style = CONFIG.Drawing.objectClass.prototype._getTextStyle.call({ document: drawingData });
    return PIXI.TextMetrics.measureText(drawingData.text || " ", style);
}

// The position and size which make the box hug the text, without the text moving on the canvas.
// wasManaged is false if the current box is one laid out by core, which centres the text within it.
export function fitToText(drawingData, wasManaged = true) {
    const { x, y, shape: box, rotation = 0 } = drawingData;
    const metrics = measureText(drawingData);
    const insets = 2 * getTextInset(drawingData);
    const fitted = { width: Math.ceil(metrics.width) + insets, height: Math.ceil(metrics.height) + insets };
    const [anchorX, anchorY] = wasManaged ? [ANCHOR_X[getAlign(drawingData)], 0] : [0.5, 0.5];

    // Core rotates a drawing around the centre of its box, so the anchor only stays put if that centre moves along the rotated axes.
    const dx = (anchorX - 0.5) * (box.width - fitted.width);
    const dy = (anchorY - 0.5) * (box.height - fitted.height);
    const angle = Math.toRadians(rotation);
    const centreX = x + box.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle);
    const centreY = y + box.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle);

    return { x: centreX - fitted.width / 2, y: centreY - fitted.height / 2, shape: fitted };
}

// Keeps the box of a managed drawing fitted to its text whoever changes it: the text editor, the config sheet or a macro.
export function refitOnUpdate(document, changes) {
    const affectsFit = REFIT_TRIGGERS.some(key => foundry.utils.hasProperty(changes, key));

    if (!affectsFit || "shape" in changes)
        return;

    const updated = foundry.utils.mergeObject(document.toObject(), changes, { inplace: false });

    if (getAlign(updated))
        foundry.utils.mergeObject(changes, fitToText(updated, getAlign(document) !== undefined));
}
