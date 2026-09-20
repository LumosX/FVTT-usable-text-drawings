import { refitOnUpdate, registerStyleSetting } from "./text-style.mjs";
import UsableTextDrawingMixin from "./drawing.mjs";
import UsableTextDrawingsLayerMixin from "./drawings-layer.mjs";
import TextEditor, { EDITING_CHANGED_HOOK } from "./text-editor.mjs";
import TextToolbar from "./text-toolbar.mjs";
import { makeTextFieldMultiline } from "./drawing-config.mjs";

Hooks.once("init", () => {
    registerStyleSetting();

    // Extending whatever is configured, rather than core's classes, keeps the module compatible with others doing the same.
    CONFIG.Drawing.objectClass = UsableTextDrawingMixin(CONFIG.Drawing.objectClass);
    CONFIG.Canvas.layers.drawings.layerClass = UsableTextDrawingsLayerMixin(CONFIG.Canvas.layers.drawings.layerClass);
});

Hooks.once("ready", () => {
    const toolbar = new TextToolbar();

    for (const hook of ["renderSceneControls", "activateSceneControls", EDITING_CHANGED_HOOK])
        Hooks.on(hook, () => toolbar.sync());
});

for (const hook of ["activateSceneControls", "canvasTearDown"])
    Hooks.on(hook, () => TextEditor.active?.commit());

Hooks.on("preUpdateDrawing", refitOnUpdate);
Hooks.on("renderDrawingConfig", makeTextFieldMultiline);
