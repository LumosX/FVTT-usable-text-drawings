import { MODULE_ID, getDefaultStyle, setDefaultStyle } from "./text-style.mjs";
import TextEditor from "./text-editor.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { FontConfig } = foundry.applications.settings.menus;

const FONT_SIZE_RANGE = { min: 8, max: 256 };

const CHOICE_ICONS = {
    align: { left: "fa-align-left", center: "fa-align-center", right: "fa-align-right" },
    valign: { top: "fa-objects-align-top", middle: "fa-objects-align-center-vertical", bottom: "fa-objects-align-bottom" }
};

// The formatting bar docked at the top of the screen. It styles the text being edited and, with it, the next new text.
export default class TextToolbar extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: `${MODULE_ID}-toolbar`,
        tag: "form",
        classes: ["faded-ui"],
        window: { frame: false, positioned: false },
        form: { handler: TextToolbar.#onChangeField, submitOnChange: true },
        actions: { choose: TextToolbar.#onChoose, toggle: TextToolbar.#onToggle, configure: TextToolbar.#onConfigure }
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
        const getChoices = key => Object.entries(CHOICE_ICONS[key]).map(([value, icon]) => ({ key, value, icon, isPressed: style[key] === value }));

        return {
            style,
            fontSizeRange: FONT_SIZE_RANGE,
            fontFamilies: FontConfig.getAvailableFontChoices(),
            defaultFontLabel: game.i18n.format("USABLE_TEXT_DRAWINGS.DefaultFont", { font: CONFIG.defaultFontFamily }),
            alignments: getChoices("align"),
            verticalAlignments: getChoices("valign"),
            isEditing: !!TextEditor.active,
            canFit: TextEditor.active?.canFit ?? false
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        this.element.classList.toggle("editing", context.isEditing);

        // A button which took the focus would take it, and the selection, away from the text being edited.
        for (const button of this.element.querySelectorAll("button"))
            button.addEventListener("mousedown", event => event.preventDefault());
    }

    static #onChangeField(event, form, formData) {
        const { fontSize, ...fields } = formData.object;
        const { min, max } = FONT_SIZE_RANGE;

        this.#restyle({ ...fields, fontSize: Math.clamp(Math.round(fontSize) || min, min, max) });
    }

    static #onChoose(event, target) {
        this.#restyle({ [target.dataset.key]: target.dataset.value });
    }

    static #onToggle(event, target) {
        this.#restyle({ [target.dataset.key]: target.getAttribute("aria-pressed") !== "true" });
    }

    static #onConfigure() {
        TextEditor.active?.configure();
    }

    #restyle(style) {
        // Whether a box is fitted to its text is down to how that text was placed, a click or a drag, not to the text before it.
        const { fit, ...stickyStyle } = style;

        setDefaultStyle({ ...getDefaultStyle(), ...stickyStyle });
        TextEditor.active?.restyle(style);
        this.render();
    }
}
