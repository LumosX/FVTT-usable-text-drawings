import { FONT_SIZE_RANGE, MODULE_ID, cleanStyle, getDefaultStyle, setDefaultStyle } from "./text-style.mjs";
import TextEditor from "./text-editor.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { FontConfig } = foundry.applications.settings.menus;

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
        actions: {
            choose: TextToolbar.#onChoose,
            toggle: TextToolbar.#onToggle,
            popover: TextToolbar.#onPopover,
            configure: TextToolbar.#onConfigure
        }
    };

    static PARTS = {
        controls: { template: `modules/${MODULE_ID}/templates/text-toolbar.hbs` }
    };

    #openPopover = null;

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
        const types = CONST.DRAWING_FILL_TYPES;
        const getChoices = key => Object.entries(CHOICE_ICONS[key]).map(([value, icon]) => ({ key, value, icon, isPressed: style[key] === value }));

        return {
            style,
            fields: CONFIG.Drawing.documentClass.schema.fields,
            fontSizeRange: FONT_SIZE_RANGE,
            fontFamilies: FontConfig.getAvailableFontChoices(),
            defaultFontLabel: game.i18n.format("USABLE_TEXT_DRAWINGS.DefaultFont", { font: CONFIG.defaultFontFamily }),
            alignments: getChoices("align"),
            verticalAlignments: getChoices("valign"),
            fillTypes: Object.entries(types).map(([name, value]) => ({ value, label: `USABLE_TEXT_DRAWINGS.fillTypes.${name.toLowerCase()}`, isSelected: style.fillType === value })),
            isPattern: style.fillType === types.PATTERN,
            hasFill: style.fillType !== types.NONE,
            hasBorder: style.strokeWidth > 0,
            isFillOpen: this.#openPopover === "fill",
            isBorderOpen: this.#openPopover === "border",
            isEditing: !!TextEditor.active,
            canFit: TextEditor.active?.canFit ?? false
        };
    }

    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        window.addEventListener("pointerdown", this.#onPointerDownAnywhere, { capture: true });
    }

    _onClose(options) {
        super._onClose(options);
        window.removeEventListener("pointerdown", this.#onPointerDownAnywhere, { capture: true });
        this.#openPopover = null;
    }

    _onRender(context, options) {
        super._onRender(context, options);
        this.element.classList.toggle("editing", context.isEditing);

        // A button which took the focus would take it, and the selection, away from the text being edited.
        for (const button of this.element.querySelectorAll("button"))
            button.addEventListener("mousedown", event => event.preventDefault());
    }

    static #onChangeField(event, form, formData) {
        this.#restyle(cleanStyle(formData.object));
    }

    static #onChoose(event, target) {
        this.#restyle({ [target.dataset.key]: target.dataset.value });
    }

    static #onToggle(event, target) {
        this.#restyle({ [target.dataset.key]: target.getAttribute("aria-pressed") !== "true" });
    }

    static #onPopover(event, target) {
        game.tooltip.deactivate();
        this.#setPopover(this.#openPopover === target.dataset.popover ? null : target.dataset.popover);
    }

    static #onConfigure() {
        TextEditor.active?.configure();
    }

    #setPopover(name) {
        this.#openPopover = name;
        this.render();
    }

    #restyle(style) {
        // Whether a box is fitted to its text is down to how that text was placed, a click or a drag, not to the text before it.
        const { fit, ...stickyStyle } = style;

        setDefaultStyle({ ...getDefaultStyle(), ...stickyStyle });
        TextEditor.active?.restyle(style);
        this.render();
    }

    #onPointerDownAnywhere = event => {
        if (this.#openPopover && !event.target.closest(`#${this.id} .popover-anchor`)) this.#setPopover(null);
    };
}
