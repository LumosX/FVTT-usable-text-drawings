import { MODULE_ID, getDefaultStyle, setDefaultStyle } from "./text-style.mjs";
import TextEditor from "./text-editor.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { FontConfig } = foundry.applications.settings.menus;

const FONT_SIZE_RANGE = { min: 8, max: 256 };

// The formatting bar docked at the top of the screen. It styles the text being edited and, with it, the next new text.
export default class TextToolbar extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: `${MODULE_ID}-toolbar`,
        tag: "form",
        classes: ["faded-ui"],
        window: { frame: false, positioned: false },
        form: { handler: TextToolbar.#onChangeField, submitOnChange: true },
        actions: { align: TextToolbar.#onAlign, configure: TextToolbar.#onConfigure }
    };

    static PARTS = {
        controls: { template: `modules/${MODULE_ID}/templates/text-toolbar.hbs` }
    };

    // Shown for as long as the text tool or the text editor is in use.
    sync() {
        const isTextToolActive = canvas.drawings?.active && game.activeTool === "text";

        if (isTextToolActive || TextEditor.active)
            this.render({ force: true });
        else if (this.rendered)
            this.close({ animate: false });
    }

    _insertElement(element) {
        document.getElementById("ui-top").append(element);
    }

    async _prepareContext() {
        const style = TextEditor.active?.style ?? getDefaultStyle();

        return {
            style,
            fontSizeRange: FONT_SIZE_RANGE,
            fontFamilies: FontConfig.getAvailableFontChoices(),
            defaultFontLabel: game.i18n.format("USABLE_TEXT_DRAWINGS.DefaultFont", { font: CONFIG.defaultFontFamily }),
            alignments: ["left", "center", "right"].map(align => ({ align, isPressed: align === style.align })),
            isEditing: !!TextEditor.active
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);

        // A button which took the focus would take it, and the selection, away from the text being edited.
        for (const button of this.element.querySelectorAll("button"))
            button.addEventListener("mousedown", event => event.preventDefault());
    }

    static #onChangeField(event, form, formData) {
        const { fontFamily, fontSize, textColor } = formData.object;
        const { min, max } = FONT_SIZE_RANGE;

        this.#restyle({ fontFamily, textColor, fontSize: Math.clamp(Math.round(fontSize) || min, min, max) });
    }

    static #onAlign(event, target) {
        this.#restyle({ align: target.dataset.align });
    }

    static #onConfigure() {
        TextEditor.active?.configure();
    }

    #restyle(style) {
        setDefaultStyle({ ...getDefaultStyle(), ...style });
        TextEditor.active?.restyle(style);
        this.render();
    }
}
